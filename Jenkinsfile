pipeline {
    agent { label "node12" }
    options { disableConcurrentBuilds() }
    stages {
        stage("Checkout") {
          steps {
            cleanWs()
            checkout([$class: 'GitSCM', branches: [[name: '$BRANCH_NAME']], doGenerateSubmoduleConfigurations: false, extensions: [], submoduleCfg: [], userRemoteConfigs: [[credentialsId: '83ff6dc5-45b4-4996-b383-e1f225203f3c', url: 'git@github.com:amilabs/eth-bulk-monitor-client-nodejs.git']]])
          }
        }
        stage("Run tests") {
          steps {
            dir("test"){
                script{
                    sh "npm i"
                    sh "mocha  --exit --reporter mocha-junit-reporter specs/"
                    junit "test-results.xml"
                }
            }
          }
        }
    }
}

