import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { EmailProcessingStack } from '../lib/email-processing-stack'

describe('EmailProcessingStack', () => {
  let app: cdk.App
  let stack: EmailProcessingStack
  let template: Template

  beforeAll(() => {
    app = new cdk.App()
    stack = new EmailProcessingStack(app, 'MyTestStack')
    template = Template.fromStack(stack)
  })

  test('S3 bucket is created with correct properties', () => {
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
    })
  })

  test('SQS queue is created with a visibility timeout of 30 seconds', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 30,
    })
  })

  test('SQS queue is created with long polling', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      ReceiveMessageWaitTimeSeconds: 20,
    })
  })

  test('SES Receipt Rule Set is created', () => {
    template.resourceCountIs('AWS::SES::ReceiptRuleSet', 1)
  })

  test('SES Receipt Rule writes emails to S3', () => {
    template.hasResourceProperties('AWS::SES::ReceiptRule', {
      Rule: {
        Enabled: true,
        ScanEnabled: true,
        Actions: Match.arrayWith([
          Match.objectLike({
            S3Action: {
              BucketName: {
                Ref: Match.stringLikeRegexp('SourceBucket*'),
              },
            },
          }),
        ]),
      },
    })
  })

  test('Lambda function is created with correct properties', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Handler: 'index.handler',
      Environment: {
        Variables: {
          QUEUE_URL: {
            Ref: Match.stringLikeRegexp('EmailProcessingQueue*'),
          },
        },
      },
    })
  })

  test('Lambda has permission to send messages to SQS', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['sqs:SendMessage']),
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': Match.arrayWith([
                Match.stringLikeRegexp('EmailProcessingQueue*'),
              ]),
            },
          }),
        ]),
      },
    })
  })

  test('S3 bucket has an event notification set for Lambda', () => {
    template.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: {
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: ['s3:ObjectCreated:*'],
            LambdaFunctionArn: {
              'Fn::GetAtt': Match.arrayWith([
                Match.stringLikeRegexp('S3EventProcessor*'),
              ]),
            },
          }),
        ]),
      },
    })
  })

  test('SES has permissions to write to S3', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:PutObject',
            Effect: 'Allow',
            Principal: {
              Service: 'ses.amazonaws.com',
            },
          }),
        ]),
      },
    })
  })
})
