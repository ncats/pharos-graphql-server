pipeline {
    options {
        skipDefaultCheckout()
        timestamps()
    }
    parameters {
        string(name: 'BUILD_VERSION', defaultValue: '', description: 'The build version to deploy (optional)')
    }
    agent {
        label 'prod && pharos && deploy'
    }
    triggers {
        pollSCM('H/5 * * * *')
    }
    environment {
        PROJECT_NAME = 'pharos-api'
        ECR_BASEURL = '853771734544.dkr.ecr.us-east-1.amazonaws.com'
    }
    stages {
        stage('Clean') {
            steps {
                cleanWs()
                checkout scm
            }
        }
        stage('Build Version') {
            when {
                allOf {
                    expression {
                        return !params.BUILD_VERSION
                    }
                }
            }
            steps {
                script {
                    BUILD_VERSION_GENERATED = VersionNumber(
                        versionNumberString: 'v${BUILD_YEAR, XX}.${BUILD_MONTH, XX}${BUILD_DAY, XX}.${BUILDS_TODAY}',
                        projectStartDate:    '1970-01-01',
                        skipFailedBuilds:    true)
                    currentBuild.displayName = BUILD_VERSION_GENERATED
                    env.BUILD_VERSION = BUILD_VERSION_GENERATED
                }
            }
        }
        stage('Build - Docker') {
            when {
                allOf {
                    expression {
                        return !params.BUILD_VERSION
                    }
                }
            }
            steps { 
                    withEnv([
                    'IMAGE_NAME=pharos-api',
                    'BUILD_VERSION=' + (env.BUILD_VERSION)
                ]) {
                        script {
                            sh '''
                            aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 853771734544.dkr.ecr.us-east-1.amazonaws.com
                            docker build --no-cache -f ./Dockerfile --build-arg BUILD_VERSION=${BUILD_VERSION} -t ${ECR_BASEURL}/${PROJECT_NAME} .
                            docker tag ${ECR_BASEURL}/${PROJECT_NAME}:latest ${ECR_BASEURL}/${PROJECT_NAME}:${BUILD_VERSION}
                            docker push ${ECR_BASEURL}/${PROJECT_NAME}:${BUILD_VERSION}
                            '''
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                configFileProvider([
                   configFile(fileId: 'pharos-api-docker-compose.yml', targetLocation: 'docker-compose.yml'),
                ]) {
                    sh  """
                        docker-compose down -v --rmi all | xargs echo
                        docker pull ${ECR_BASEURL}/${PROJECT_NAME}:$BUILD_VERSION
                        docker rmi ${ECR_BASEURL}/${PROJECT_NAME}:current | xargs echo
                        docker tag ${ECR_BASEURL}/${PROJECT_NAME}:${BUILD_VERSION} ${ECR_BASEURL}/${PROJECT_NAME}:current
                        docker-compose -p $PROJECT_NAME up -d
                        docker rmi \$(docker images -aq) | xargs echo
                    """
                }
            }
        }
    }
}
