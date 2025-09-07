{
  description = "Omot";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        # Define Node.js and Yarn as build inputs for the dev shell
        yarnNodeEnv = pkgs.nodejs_22; # Or your preferred Node.js version
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            yarnNodeEnv
            pkgs.yarn # The yarn package manager itself
          ];
          # Optional: Set environment variables for the shell
          shellHook = ''
            echo "Node.js and Yarn are available!"
          '';
        };
      }
    );
}
