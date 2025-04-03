import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { EmailProcessingStack } from '../lib/email-processing-stack'

test('S3 bucket and SQS queue are created', () => {
  const app = new cdk.App()
  const stack = new EmailProcessingStack(app, 'MyTestStack')

  const template = Template.fromStack(stack)

  // Check if an S3 Bucket is created
  template.hasResource('AWS::S3::Bucket', {})

  // Check if an SQS Queue is created
  template.hasResource('AWS::SQS::Queue', {})
})
