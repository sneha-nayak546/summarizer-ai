pipeline {
    agent any
    environment {
        IMAGE_NAME = "summarizer-ai"
        IMAGE_TAG  = "500"
        CONTAINER_NAME = "summarizer-b500"
        APP_PORT = "5000"
    }
    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Build Docker Image') {
            steps { bat 'docker build -t summarizer-ai:500 .' }
        }
        stage('Stop Old Container') {
            steps {
                bat 'docker stop summarizer-b500 || echo no container'
                bat 'docker rm summarizer-b500 || echo no container'
            }
        }
        stage('Run New Container') {
            steps { bat 'docker run -d -p 5000:5000 --name summarizer-b500 summarizer-ai:500' }
        }
        stage('Health Check') {
            steps {
                sleep(time: 10, unit: 'SECONDS')
                bat 'curl -f http://localhost:5000/ || exit 1'
            }
        }
    }
    post {
        success { echo 'Deployed successfully!' }
        failure { echo 'Build failed!' }
    }
}