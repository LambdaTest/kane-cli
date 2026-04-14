# typed: false
# frozen_string_literal: true

class KaneCli < Formula
  desc "KaneAI browser automation CLI - AI-powered testing"
  homepage "https://www.lambdatest.com/kane-ai"
  license "Apache-2.0"
  version "0.1.0"

  on_macos do
    on_arm do
      url "https://github.com/LambdaTest/kane-cli/releases/download/v#{version}/kane-cli-darwin-arm64"
      sha256 "PLACEHOLDER_DARWIN_ARM64"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/LambdaTest/kane-cli/releases/download/v#{version}/kane-cli-linux-x64"
      sha256 "PLACEHOLDER_LINUX_X64"
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
