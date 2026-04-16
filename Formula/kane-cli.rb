# typed: false
# frozen_string_literal: true

class KaneCli < Formula
  desc "KaneAI browser automation CLI - AI-powered testing"
  homepage "https://www.lambdatest.com/kane-ai"
  license "Apache-2.0"
  version "0.2.0"

  on_macos do
    on_arm do
      url "https://github.com/LambdaTest/kane-cli/releases/download/v#{version}/kane-cli-darwin-arm64"
      sha256 "3e07b923e6720d107d03914e3367b07289eee794d555a1e59be07941c3f86386"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/LambdaTest/kane-cli/releases/download/v#{version}/kane-cli-linux-x64"
      sha256 "ea5bc82d4d4858454595c1d5a934f7921e11192a45394f0213e42f0394e0a069"
    end
  end

  def install
    if OS.mac?
      bin.install "kane-cli-darwin-arm64" => "kane-cli"
    elsif OS.linux?
      bin.install "kane-cli-linux-x64" => "kane-cli"
    end
  end

  def caveats
    <<~EOS
      Currently supported platforms: macOS ARM64 (Apple Silicon) and Linux x64.
      Intel Mac and ARM Linux binaries are not yet available.
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/kane-cli --version")
  end
end
