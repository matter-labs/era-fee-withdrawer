FROM era-fee-withdrawer-azure:latest

WORKDIR /app

COPY enclave-key.pem /tmp/

RUN set -eux; \
    export HOME=/app; \
    gramine-manifest \
      -Darch_libdir=/lib/x86_64-linux-gnu \
      -Dentrypoint=$(readlink /bin/era-fee-withdrawer) \
      -Dexecdir=/bin \
      -Dlog_level=error \
      era-fee-withdrawer.manifest.toml era-fee-withdrawer.manifest; \
    gramine-sgx-sign --manifest era-fee-withdrawer.manifest --output era-fee-withdrawer.manifest.sgx --key /tmp/enclave-key.pem; \
    rm /tmp/enclave-key.pem


# Uncomment, if a signed sigstruct exists
# COPY era-fee-withdrawer-azure.sig .
# RUN mv era-fee-withdrawer-azure.sig era-fee-withdrawer
RUN touch -r /nix/store era-fee-withdrawer.sig

ENTRYPOINT ["/bin/sh", "-c"]
#CMD [ "echo tee-era-fee-withdrawer in simulation mode starting ; exec gramine-direct era-fee-withdrawer" ]
CMD [ "echo tee-era-fee-withdrawer in SGX mode starting ; [[ -r /var/run/aesmd/aesm.socket ]] || restart-aesmd ; exec gramine-sgx era-fee-withdrawer" ]
