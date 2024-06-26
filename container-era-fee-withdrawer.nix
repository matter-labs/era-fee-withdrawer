{ pkgs
, nixsgx-flake
, efw
, tag ? "latest"
, isAzure ? true
}:
let
  name = if isAzure then "era-fee-withdrawer-azure" else "era-fee-withdrawer-dcap";
in
pkgs.callPackage nixsgx-flake.lib.mkSGXContainer {
  inherit name;
  inherit tag;

  packages = [ efw.era-fee-withdrawer ];
  entrypoint = "${efw.era-fee-withdrawer}/bin/era-fee-withdrawer";

  extraCmd = "echo Starting era-fee-withdrawer; is-sgx-available; gramine-sgx-sigstruct-view app.sig";

  isAzure = true;

  manifest = {
    loader = {
      log_level = "error";
      env = {
        UV_USE_IO_URING = "0";
        MISC_FEE_ACCOUNT_PRIVATE_KEY.passthrough = true;
        OPERATOR_ADDRESS.passthrough = true;
        WITHDRAWAL_FINALIZER_ETH_ADDRESS.passthrough = true;
        MISC_RESERVE_FEE_ACCUMULATOR_ADDRESS.passthrough = true;
        L1_RPC_ADDRESS.passthrough = true;
        ZKSYNC_WEB3_API_URL.passthrough = true;
        MISC_MAX_LIQUIDATION_FEE_PERCENT.passthrough = true;
        LOWER_BOUND_OPERATOR_THRESHOLD.passthrough = true;
        UPPER_BOUND_OPERATOR_THRESHOLD.passthrough = true;
        LOWER_BOUND_WITHDRAWER_THRESHOLD.passthrough = true;
        UPPER_BOUND_WITHDRAWER_THRESHOLD.passthrough = true;
        LOWER_BOUND_PAYMASTER_THRESHOLD.passthrough = true;
        UPPER_BOUND_PAYMASTER_THRESHOLD.passthrough = true;
        # optional env
        WATCHDOG_ADDRESS.passthrough = true;
        LOWER_BOUND_WATCHDOG_THRESHOLD.passthrough = true;
        UPPER_BOUND_WATCHDOG_THRESHOLD.passthrough = true;
        L1_ETH_TRANSFER_THRESHOLD.passthrough = true;
        L2_ETH_TRANSFER_THRESHOLD.passthrough = true;
        CONTRACTS_L2_TESTNET_PAYMASTER_ADDR.passthrough = true;
      };
    };

    sgx = {
      edmm_enable = false;
      enclave_size = "8G";
      max_threads = 64;
    };
  };
}
