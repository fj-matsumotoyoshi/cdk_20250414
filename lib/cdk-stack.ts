import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { 
          aws_ec2 as ec2,
          aws_ecs as ecs,
          aws_ecr as ecr,
          aws_logs as logs,
          aws_s3 as s3,
          aws_ecs_patterns as ecs_patterns,
         } from 'aws-cdk-lib'; 
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

import {
          aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';

import { Tags } from 'aws-cdk-lib';

import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';



export class CDKStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const envName = "mlda-sand-matsuy";


    //CloudWatch Logs
    
    const logGroup = new logs.LogGroup(this, `${envName}-loggroup-for-app-task`, {
      logGroupName: `/aws/ecs/${envName}-app-log`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    Tags.of(logGroup).add('Service', 'MACHILDA');
    Tags.of(logGroup).add('Env', 'DEV');

    
    
    const publicSubnetConfiguration = {
      cidrMask: 22,
      name: 'public-subnet',
      subnetType: ec2.SubnetType.PUBLIC,
    };
    const privateAPPSubnetConfiguration = {
      cidrMask: 22,
      name: 'private-app-subnet',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    const privateDBSubnetConfiguration = {
      cidrMask: 22,
      name: 'private-db-subnet',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    };

    

   

    const CIDR = ec2.IpAddresses.cidr('10.0.0.0/16')


    //VPC
    const vpc = new ec2.Vpc(this, `${envName}-vpc`,{
      ipAddresses: CIDR,
      maxAzs: 2,
      vpcName: `${envName}-vpc`,
      restrictDefaultSecurityGroup: true,

      subnetConfiguration: [
        privateAPPSubnetConfiguration,
        privateDBSubnetConfiguration,
        publicSubnetConfiguration
      ]
    });

    Tags.of(vpc).add('Service', 'MACHILDA');
    Tags.of(vpc).add('Env', 'DEV');

    const sg = new ec2.SecurityGroup(this, `${envName}-sg`, {
      vpc: vpc,
    });

    const securityGroupForApp = new ec2.SecurityGroup(this, `${envName}-sg-for-app`, {
      vpc: vpc,
    });


    const ecrRepository = new ecr.Repository(this, `${envName}-ecr-repo`, {
      repositoryName: `${envName}-app-ecr-repository`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
    });

    vpc.addInterfaceEndpoint(`${envName}-vpc-to-ecr-endpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: privateAPPSubnetConfiguration,
      securityGroups: [securityGroupForApp]
    });

    vpc.addInterfaceEndpoint(`${envName}-vpc-ecr-docker-endpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: privateAPPSubnetConfiguration,
      securityGroups: [securityGroupForApp]
    });

       // VPCエンドポイント追加（CloudWatchと接続）
       vpc.addInterfaceEndpoint(`${envName}-vpc-cloudwatch-endpoint`, {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        subnets: privateAPPSubnetConfiguration,
        securityGroups: [securityGroupForApp],
      });
      // VPCエンドポイント追加（ECR用のS3と接続）
      vpc.addGatewayEndpoint(`${envName}-vpc-ecr-s3-endpoint`, {
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        subnets: [
          privateAPPSubnetConfiguration,
        ],
      });

        // ログ用S3バケット定義 TODO: ログ定義
        const logBucket = new s3.Bucket(this, `${envName}-app-task-log`, {
          bucketName: `${envName}-app-task-log`,
          encryption: s3.BucketEncryption.S3_MANAGED,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
          // --- ▼「S3 汎用バケットではパブリックアクセスをブロックする必要があります」対処
          // --- ▼「S3 汎用バケットではパブリック書き込みアクセスをブロックする必要があります」対処 ---
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          // --- ▼「S3 汎用バケットではパブリック読み取りアクセスをブロックする必要があります」対処 ---
          publicReadAccess: false,
    
          // S3バケットサーバーのアクセスログ設定
          serverAccessLogsBucket: undefined,  // TODO: 検証と商用環境の場合には指定のバケットへ送信する // i2iを参考
    
          // オブジェクト所有者の設定（ACLを無効にして、オブジェクト所有者をバケットを所有しているアカウントに変更）
          objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        });

        Tags.of(logBucket).add('Service', 'MACHILDA');
        Tags.of(logBucket).add('Env', 'DEV');





    const cluster = new ecs.Cluster(this, `${envName}-app-ecs-cluster`, {
      vpc,
      clusterName: `${envName}-app-cluster`,
      executeCommandConfiguration: {
        logConfiguration: {
          cloudWatchLogGroup: logGroup,
          cloudWatchEncryptionEnabled: true,
          s3Bucket: logBucket,
          s3EncryptionEnabled: true,
          s3KeyPrefix: 'ecs-exec',
        },
        logging: ecs.ExecuteCommandLogging.OVERRIDE,
      },
    });
    Tags.of(cluster).add('Service', 'MACHILDA');
    Tags.of(cluster).add('Env', 'DEV');








    const myIpAddress = "MyAddress/32";
    const allowIpv4Address = myIpAddress;

    const ecsTaskDef = new ecs.FargateTaskDefinition(this, `${envName}-app-ecs-task-definition`);

    
    const container = ecsTaskDef.addContainer(`${envName}-ecs-container`, {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
      readonlyRootFilesystem: true,
      privileged: false,
      user: '1000',
      portMappings: [
        {
          containerPort: 8000,
          protocol: ecs.Protocol.TCP,
        },
      ],
      containerName: `${envName}-app`,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `${envName}-ecs-logs`,
        logGroup: logGroup,
      }),
      healthCheck: {
        command: [ "CMD-SHELL", "curl -f http://localhost:8000/ || exit 1" ],
        interval: cdk.Duration.seconds(30),
        retries: 2,
        startPeriod: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(30),
      },
    });
    
    
    const ecsWithALB = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${envName}-app-ecs`, {
      serviceName: `${envName}-app-ecs`,
      loadBalancerName: `${envName}-app-ecs-alb`,
      cluster: cluster,
      taskDefinition: ecsTaskDef,
      memoryLimitMiB: 512,
      cpu: 256,
      ephemeralStorageGiB: 100,
      openListener: false,
      securityGroups: [securityGroupForApp],
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
      propagateTags: ecs.PropagatedTagSource.TASK_DEFINITION,
      taskSubnets: privateAPPSubnetConfiguration,
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
      desiredCount: 1,
      listenerPort: 80,
    });
    


   
    // ロードバランサーの穴あけ
    // ecsWithALB.loadBalancer.connections.allowFrom(ec2.Peer.ipv4(allowIpv4Address), ec2.Port.HTTP, 'allow inbound');

    // ALBのアクセスログを有効化
    ecsWithALB.loadBalancer.logAccessLogs(logBucket, 'ecs-alb-access-logs');

    
    

    const scalableTarget = ecsWithALB.service.autoScaleTaskCount({
      maxCapacity: 2,
      minCapacity: 1
    });
    scalableTarget.scaleOnCpuUtilization('CPUScaling', {
      targetUtilizationPercent: 50
    });
    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50
    });

    ecsWithALB.service.connections.allowFrom(
      ecsWithALB.loadBalancer,
      ec2.Port.tcp(8000),
    );

    

  }
}

