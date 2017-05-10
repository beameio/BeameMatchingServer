node('linux') {
   stage('Checkout') {
     checkout scm
   }
   stage('Build') {
         sh('export BRANCH=${BRANCH_NAME}; make build-jenkins')
   }
   stage('Archive') {
        archiveArtifacts artifacts: 'build/*.tar.gz'
   }
   stage("publish to s3") {
    def gitCommit = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
    step([
        $class: 'S3BucketPublisher',
        entries: [[
            sourceFile: 'build/*.tar.gz',
            bucket: "beame-build-products/${env.JOB_NAME}/${env.BUILD_NUMBER}",
            selectedRegion: 'eu-central-1',
            noUploadOnFailure: true,
            managedArtifacts: false,
            flatten: true,
            showDirectlyInBrowser: false,
            keepForever: false,
        ]],
        userMetadata: [[ key: 'git_branch', value: "${env.BRANCH_NAME}"],
                       [ key: 'build_number', value: "${env.BUILD_NUMBER}"],
                       [ key: 'git_revision', value: "$gitCommit"]
        ],
        profileName: 'default',
        dontWaitForConcurrentBuildCompletion: false,
    ])
  }
}
