import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { 
          aws_ec2 as ec2,
          aws_ecs as ecs,
         } from 'aws-cdk-lib'; 
// import * as sqs from 'aws-cdk-lib/aws-sqs';


export class Cdk20250414Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const privateSubnectConfiguration = {
      cidrMask: 24,
      name: 'private-subnet',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };
    
    const publicSubnectConfiguration = {
      cidrMask: 24,
      name: 'public-subnet',
      subnetType: ec2.SubnetType.PUBLIC,
    };

    const CIDR = ec2.IpAddresses.cidr('192.168.0.0/16')


    //VPC
    const vpc = new ec2.Vpc(this, 'mlda-sandbox-vpc',{
      ipAddresses: CIDR,
      maxAzs: 2,
      vpcName: 'mlda-sandbox-vpc',

      subnetConfiguration: [
        privateSubnectConfiguration,
        publicSubnectConfiguration
      ]
    });

    const sg = new ec2.SecurityGroup(this, 'mlda-sandbox-sg', {
      vpc: vpc,
    });

    const cluster = new Cluster(this, 'mlda-dev-cluster', {
      vpc,
      clusterName: 'mlda-dev-cluster',
    });





    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'Cdk20250414Queue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
