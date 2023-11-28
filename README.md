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
$ nix build -L .#docker-era-fee-withdrawer-azure
$ cp result era-fee-withdrawer-azure.tar.gz
$ exit
```
## Build the Docker image
```bash
$ docker load < era-fee-withdrawer-azure.tar.gz
$ docker build --no-cache --progress=plain -t efw -f Dockerfile .
```

Should output something like:
```bash
[...]

#9 6.572 Measurement:
#9 6.572     e3ea485757ad903e9a9a71c7363bf56d4cf47db1ccec549f5e98d917b0f34b27
[...]
```
as the github actions build does.
