---
layout: post
title: "An Example Implement Ansible Deployment on Github Action"
Description: ""
date: 2024-04-22
tags: [DevOps]
---

```yaml

- name: write secrets into json
  run: |
    echo "${{ toJSON(secrets) }}" > _github_secrets.json
- name: write github repo vars into json
  run: |
    echo "${{ toJSON(vars) }}" > _github_vars.json
- name: write ssh private key
  run: |
    echo "${{ secrets.STAG_SSH_PRIVATE_KEY }}" > ${{ github.workspace }}/.ssh_private_key.pem
    chmod 0400 ${{ github.workspace }}/.ssh_private_key.pem
- name: write ssl certificate
  run: |
    echo "${{ secrets.showmecodes_TLS_CERTIFICATES }}" > ${{ github.workspace }}/showmecodes.ai.pem
    echo "${{ secrets.showmecodes_TLS_KEY }}" > ${{ github.workspace }}/showmecodes.ai.key
- name: deploy showmecodes to stag
  uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: playbook-showmecodes.yml
    key: ${{ secrets.STAG_SSH_PRIVATE_KEY }}
    options: |
      --inventory env_vars/${{env.APP_ENV}}/hosts.yaml
      --extra-vars "app_backend_zip_path=${{ needs.init_build_version.outputs.backendArtifactName }} app_frontend_zip_path=${{ needs.init_build_version.outputs.fontendStagArtifactName }} app_version=${{ needs.init_build_version.outputs.VERSION }} ansible_ssh_private_key_file=${{ github.workspace }}/.ssh_private_key.pem showmecodes_tls_certificate_file=${{ github.workspace }}/showmecodes.ai.pem showmecodes_tls_private_key_file=${{ github.workspace }}/showmecodes.ai.key" --extra-vars=@_github_vars.json --extra-vars=@_github_secrets.json

```
