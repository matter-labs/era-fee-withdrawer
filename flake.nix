{
  description = "era-fee-withdrawer";

  nixConfig = {
    extra-substituters = ["https://nixsgx.cachix.org"];
    extra-trusted-public-keys = ["nixsgx.cachix.org-1:tGi36DlY2joNsIXOlGnSgWW0+E094V6hW0umQRo/KoE="];
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
                version = "2.2.33";
                src = pkgs.fetchFromGitHub {
                  owner = "matter-labs";
                  repo = "era-fee-withdrawer";
                  rev = "v2.2.33";
                  hash = "sha256-vyNldcUErQ/aD/Oprbs0OocTv0ARQ0/WG05WrN13IO8=";
                };
              };

          container-era-fee-withdrawer-azure = pkgs.callPackage ./container-era-fee-withdrawer.nix { inherit nixsgx-flake; isAzure = true; };
          container-era-fee-withdrawer-dcap = pkgs.callPackage ./container-era-fee-withdrawer.nix { inherit nixsgx-flake; isAzure = false; };
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
