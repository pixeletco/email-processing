import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications'
import * as ses from 'aws-cdk-lib/aws-ses'
import * as sesActions from 'aws-cdk-lib/aws-ses-actions'
import * as sqs from 'aws-cdk-lib/aws-sqs'

export class EmailProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Create an SQS queue that allows our application to process incoming messages
    const emailProcessingQueue = new sqs.Queue(this, 'EmailProcessingQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    })

    // Create an S3 bucket for storing emails received from SES.
    const sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain bucket data after deletion
      autoDeleteObjects: false,
    })

    // Create an SES receipt rule set.
    const receiptRuleSet = new ses.ReceiptRuleSet(this, 'ReceiptRuleSet', {
      receiptRuleSetName: 'EmailToS3RuleSet',
    })

    // Create an SES receipt rule to save all emails to S3.
    new ses.ReceiptRule(this, 'StoreEmailInS3', {
      ruleSet: receiptRuleSet,
      actions: [
        new sesActions.S3({
          bucket: sourceBucket,
        }),
      ],
      enabled: true,
      scanEnabled: true, // Enable spam/virus scanning
    })

    // Create a Lambda function that processes S3 events and sends messages to SQS.
    const s3EventProcessor = new lambdaNodejs.NodejsFunction(
      this,
      'S3EventProcessor',
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: 'lambda/handle-s3-events.ts',
        handler: 'handler',
        environment: {
          QUEUE_URL: emailProcessingQueue.queueUrl,
        },
      }
    )

    // Grant the Lambda function permission to send messages to the SQS queue.
    emailProcessingQueue.grantSendMessages(s3EventProcessor)

    // Set up S3 event notifications to trigger Lambda on new objects.
    sourceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(s3EventProcessor)
    )

    // Grant SES permissions to write to the S3 bucket.
    sourceBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
        resources: [`${sourceBucket.bucketArn}/*`],
      })
    )
  }
}
