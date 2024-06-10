# SGX era-fee-withdrawer

This is a reproducible build of https://github.com/matter-labs/era-fee-withdrawer
with the gramine runtime to be run on SGX in Azure.

## Reproduce the NixOS build
```bash
$ docker run --privileged -it -v .:/mnt nixos/nix:2.18.1
```
Inside the container:
```bash
$ echo 'experimental-features = nix-command flakes' >> /etc/nix/nix.conf
$ echo 'sandbox = true' >> /etc/nix/nix.conf
$ cd /mnt
$ nix build -L .#container-era-fee-withdrawer-azure
$ cp result era-fee-withdrawer-azure.tar.gz
$ exit
```
## Load the Docker image
```bash
$ docker load < era-fee-withdrawer-azure.tar.gz
$ docker run -v $(pwd):/mnt -i --init --rm era-fee-withdrawer-azure:latest "cp era-fee-withdrawer-azure.sig /mnt"
$ gramine-sgx-sigstruct-view era-fee-withdrawer-azure.sig
```

Should output something like:
```bash
Attributes:
    mr_signer: c5591a72b8b86e0d8814d6e8750e3efe66aea2d102b8ba2405365559b858697d
    mr_enclave: f496995ebf3428638858c315d6194e5578df0ed0cefbcaf67b24d5d9322965bc
    isv_prod_id: 0
    isv_svn: 0
    debug_enclave: False
```

with the same `mr_enclave` as the github actions build does.
