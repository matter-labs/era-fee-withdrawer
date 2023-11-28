{ lib
, nixsgx
, mkYarnPackage
, fetchYarnDeps
, makeWrapper
, src
, version
, pname
}:

mkYarnPackage {
  inherit version src pname;

  offlineCache = fetchYarnDeps {
    yarnLock = src + "/yarn.lock";
    hash = "sha256-V2Qev42NMA0i+07J6h+WZhO+g0gX/7rEf2HpaVcu6Ts=";
  };

  nativeBuildInputs = [
    nixsgx.nodejs
    makeWrapper
  ];

  postInstall = ''
    rm -fr $out/libexec/fee-withdrawer-v2/deps/fee-withdrawer-v2/.github
    makeWrapper '${nixsgx.nodejs}/bin/node' "$out/bin/${pname}" \
      --add-flags "$out/libexec/fee-withdrawer-v2/node_modules/ts-node/dist/bin.js" \
      --add-flags "$out/libexec/fee-withdrawer-v2/deps/fee-withdrawer-v2/src/index.ts" \
  '';
  distPhase = "true";
}
