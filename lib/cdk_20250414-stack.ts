import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';


export class Cdk20250414Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new Vpc(this, 'machilda-dev-Vpc');

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'Cdk20250414Queue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
