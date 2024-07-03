{
  description = "era-fee-withdrawer";

  nixConfig = {
    extra-substituters = ["https://attic.teepot.org/tee-pot"];
    extra-trusted-public-keys = ["tee-pot:SS6HcrpG87S1M6HZGPsfo7d1xJccCGev7/tXc5+I4jg="];
  };

  inputs = {
    nixsgx-flake.url = "github:matter-labs/nixsgx";
    nixpkgs.follows = "nixsgx-flake/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils?tag=v1.0.0";
  };

  outputs = { self, nixpkgs, flake-utils, nixsgx-flake }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ]
      (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [
              nixsgx-flake.overlays.default
              self.overlays.default
            ];
          };
          era-fee-withdrawer =
            pkgs.callPackage
              ./era-fee-withdrawer.nix
              {
                pname = "era-fee-withdrawer";
                version = "2.2.36";
                src = pkgs.fetchFromGitHub {
                  owner = "matter-labs";
                  repo = "era-fee-withdrawer";
                  rev = "v2.2.36";
                  hash = "sha256-lgXOmtK4DKQbIJMLRLuOQOK0RgDA+L3gLua27nsGkAU=";
                };
              };

          container-era-fee-withdrawer-azure = pkgs.callPackage ./container-era-fee-withdrawer.nix { isAzure = true; };
          container-era-fee-withdrawer-dcap = pkgs.callPackage ./container-era-fee-withdrawer.nix { isAzure = false; };
        in
        {
          formatter = pkgs.nixpkgs-fmt;

          packages = {
            inherit era-fee-withdrawer;
            inherit container-era-fee-withdrawer-azure;
            inherit container-era-fee-withdrawer-dcap;
            default = container-era-fee-withdrawer-azure;
          };

          devShells = {
            default = pkgs.mkShell {
              inputsFrom = [ era-fee-withdrawer ];
              nativeBuildInputs = with pkgs; [
                nixsgx.gramine
              ];
            };
          };
        }) // {
      overlays.default = final: prev: { efw = { inherit (self.packages.${prev.system}) era-fee-withdrawer; }; };
    };
}
