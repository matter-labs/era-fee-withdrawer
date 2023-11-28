{
  description = "era-fee-withdrawer";

  inputs = {
    nixsgx-flake.url = "github:matter-labs/nixsgx";
    nixpkgs.follows = "nixsgx-flake/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, nixsgx-flake }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; overlays = [ nixsgx-flake.overlays.default ]; };
        era-fee-withdrawer =
          pkgs.callPackage
            ./era-fee-withdrawer.nix
            {
              pname = "era-fee-withdrawer";
              version = "2.2.33";
              src = pkgs.fetchFromGitHub {
                owner = "matter-labs";
                repo = "era-fee-withdrawer";
                rev = "v2.2.33";
                hash = "sha256-vyNldcUErQ/aD/Oprbs0OocTv0ARQ0/WG05WrN13IO8=";
              };
            };
        efw-pkgs = { inherit era-fee-withdrawer; };

        docker-era-fee-withdrawer-azure = pkgs.callPackage ./docker-era-fee-withdrawer-azure.nix efw-pkgs;
        docker-era-fee-withdrawer-dcap = pkgs.callPackage ./docker-era-fee-withdrawer-dcap.nix efw-pkgs;
      in
      {
        formatter = pkgs.nixpkgs-fmt;

        packages = {
          inherit era-fee-withdrawer;
          inherit docker-era-fee-withdrawer-azure;
          inherit docker-era-fee-withdrawer-dcap;
          default = docker-era-fee-withdrawer-azure;
        };

        devShells = {
          default = pkgs.mkShell {
            inputsFrom = [ era-fee-withdrawer ];
            nativeBuildInputs = with pkgs; [
              nixsgx.gramine
            ];
          };
        };
      });
}
