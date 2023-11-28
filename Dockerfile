FROM node:14-bullseye-slim

# required env
# ENV MISC_FEE_ACCOUNT_PRIVATE_KEY
# ENV OPERATOR_ADDRESS
# ENV WITHDRAWAL_FINALIZER_ETH_ADDRESS
# ENV MISC_RESERVE_FEE_ACCUMULATOR_ADDRESS
# ENV L1_RPC_ADDRESS
# ENV ZKSYNC_WEB3_API_URL
# ENV MISC_MAX_LIQUIDATION_FEE_PERCENT
# ENV ZKSYNC_WEB3_API_URL
# ENV LOWER_BOUND_OPERATOR_THRESHOLD
# ENV UPPER_BOUND_OPERATOR_THRESHOLD
# ENV LOWER_BOUND_WITHDRAWER_THRESHOLD
# ENV UPPER_BOUND_WITHDRAWER_THRESHOLD
# ENV LOWER_BOUND_PAYMASTER_THRESHOLD
# ENV UPPER_BOUND_PAYMASTER_THRESHOLD
# optional env
# ENV WATCHDOG_ADDRESS
# ENV LOWER_BOUND_WATCHDOG_THRESHOLD
# ENV UPPER_BOUND_WATCHDOG_THRESHOLD
# ENV L1_ETH_TRANSFER_THRESHOLD
# ENV L2_ETH_TRANSFER_THRESHOLD
# ENV CONTRACTS_L2_TESTNET_PAYMASTER_ADDR

RUN set -eux; \
    apt-get update; \
    apt-get install -y curl;

RUN echo "deb http://deb.debian.org/debian bullseye-backports main" > /etc/apt/sources.list.d/backports.list

RUN set -eux; \
    curl -fsSLo /usr/share/keyrings/gramine-keyring.gpg https://packages.gramineproject.io/gramine-keyring.gpg; \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gramine-keyring.gpg] https://packages.gramineproject.io/ bullseye main" > /etc/apt/sources.list.d/gramine.list

RUN set -eux; \
    curl -fsSLo /usr/share/keyrings/intel-sgx-deb.asc https://download.01.org/intel-sgx/sgx_repo/ubuntu/intel-sgx-deb.key; \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/intel-sgx-deb.asc] https://download.01.org/intel-sgx/sgx_repo/ubuntu focal main" > /etc/apt/sources.list.d/intel-sgx.list

RUN set -eux; \
    curl -fsSLo /usr/share/keyrings/microsoft.asc https://packages.microsoft.com/keys/microsoft.asc; \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.asc] https://packages.microsoft.com/ubuntu/20.04/prod focal main" > /etc/apt/sources.list.d/msprod.list

# Install gramine
RUN set -eux; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y gramine \
    libsgx-dcap-quote-verify \
    az-dcap-client \
    psmisc \
    ;

# for libprotobuf17 for the sgx-aesm-service
RUN set -eux; \
    curl -fsSLo /etc/apt/trusted.gpg.d/ubuntu1.asc 'http://keyserver.ubuntu.com/pks/lookup?op=get&search=0x790bc7277767219c42c86f933b4fe6acc0b21f32' ; \
    curl -fsSLo /etc/apt/trusted.gpg.d/ubuntu2.asc 'http://keyserver.ubuntu.com/pks/lookup?op=get&search=0xf6ecb3762474eda9d21b7022871920d1991bc93c' ; \
    echo "deb http://de.archive.ubuntu.com/ubuntu focal main" > /etc/apt/sources.list.d/focal.list; \
    :

# Install sgx-aesm-service
RUN set -eux; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y gramine \
    sgx-aesm-service \
    libsgx-aesm-launch-plugin \
    libsgx-aesm-epid-plugin \
    libsgx-aesm-quote-ex-plugin \
    libsgx-aesm-ecdsa-plugin; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/run/aesmd/

WORKDIR /app

# original fee-withdrawer with no yarn symlinks and removed cache

COPY . .
RUN yarn --no-bin-links install && rm -fr /usr/local/share/.cache/yarn /tmp/*

RUN mkdir .dcap-qcnl .az-dcap-client

RUN set -eux; \
    gramine-manifest -Darch_libdir=/lib/x86_64-linux-gnu -Dexecdir=/usr/bin -Dlog_level=warning era-fee-withdrawer.manifest.template era-fee-withdrawer.manifest; \
    gramine-sgx-sign --manifest era-fee-withdrawer.manifest --output era-fee-withdrawer.manifest.sgx --key enclave-key.pem; \
    rm enclave-key.pem

ENTRYPOINT ["/bin/sh", "-c"]
# CMD [ "./restart_aesm.sh ; exec gramine-sgx era-fee-withdrawer" ]
CMD [ "exec gramine-direct era-fee-withdrawer" ]
