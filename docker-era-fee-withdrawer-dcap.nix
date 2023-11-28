{ pkgs
, bash
, curl
, nixsgx
, cacert
, coreutils
, openssl
, era-fee-withdrawer
}:
let manifest = ./era-fee-withdrawer.manifest.toml;
in pkgs.dockerTools.buildLayeredImage {
  name = "era-fee-withdrawer-dcap";
  tag = "latest";

  config.Env = [
    "SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt"
    "UV_USE_IO_URING=0"
  ];
  config.Entrypoint = [ "/bin/sh" "-c" ];

  contents = pkgs.buildEnv {
    name = "image-root";
    paths = with pkgs.dockerTools; with nixsgx; [
      bash
      coreutils
      openssl.out
      curl.out
      era-fee-withdrawer
      gramine
      restart-aesmd
      sgx-dcap.default_qpl
      sgx-dcap.quote_verify
      sgx-psw
      usrBinEnv
      binSh
      caCertificates
      fakeNss
    ];
    pathsToLink = [ "/bin" "/lib" "/etc" ];
    postBuild = ''
      mkdir -p $out/{app,etc}
      mkdir -p $out/app/{.dcap-qcnl,.az-dcap-client}
      mkdir -p $out/var/run
      mkdir -p $out/${nixsgx.sgx-psw.out}/aesm/
      ln -s ${curl.out}/lib/libcurl.so $out/${nixsgx.sgx-psw.out}/aesm/
      cp ${manifest} $out/app/era-fee-withdrawer.manifest.toml
      printf "precedence ::ffff:0:0/96  100\n" > $out/etc/gai.conf
    '';
  };
}

