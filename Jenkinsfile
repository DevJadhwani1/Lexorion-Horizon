pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend Compile') {
            steps {
                script {
                    def modules = ['platform-service', 'workforce-service', 'payroll-service',
                                   'finance-service', 'api-gateway', 'eureka-server']
                    def jobs = modules.collectEntries { module ->
                        [(module): {
                            dir("backend/${module}") {
                                sh './mvnw -B -DskipTests compile'
                            }
                        }]
                    }
                    parallel jobs
                }
            }
        }

        stage('Backend Tests') {
            steps {
                script {
                    def modules = ['platform-service', 'workforce-service', 'payroll-service',
                                   'finance-service', 'api-gateway', 'eureka-server']
                    def jobs = modules.collectEntries { module ->
                        [(module): {
                            dir("backend/${module}") {
                                sh './mvnw -B test'
                            }
                        }]
                    }
                    parallel jobs
                }
            }
            post {
                always {
                    junit testResults: 'backend/*/target/surefire-reports/*.xml', allowEmptyResults: false
                }
            }
        }

        stage('Frontend Install') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Frontend Typecheck') {
            steps {
                dir('frontend') {
                    sh 'npm run typecheck'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
                archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
            }
        }

        stage('Docker Image Build') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Docker Compose Validation') {
            steps {
                sh 'docker compose config -q'
            }
        }

        stage('Verification Summary') {
            steps {
                echo 'Backend compile/tests, frontend checks, Docker image builds, and Compose validation passed.'
                echo 'No containers were started, no images were pushed, and PostgreSQL was not managed by this pipeline.'
            }
        }
    }

}
