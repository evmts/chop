const std = @import("std");

pub fn build(b: *std.Build) void {
    // ========================================
    // Guillotine-mini Dependency Build
    // ========================================

    // Get guillotine-mini as a dependency
    const guillotine_dep = b.dependency("guillotine_mini", .{
        .target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        }),
        .optimize = .ReleaseSmall,
    });

    // Get the WASM artifact from guillotine-mini
    const guillotine_wasm = guillotine_dep.artifact("guillotine-mini");

    const guillotine_install = b.addInstallArtifact(guillotine_wasm, .{});

    const guillotine_step = b.step("guillotine", "Build guillotine-mini WASM library");
    guillotine_step.dependOn(&guillotine_install.step);

    // ========================================
    // Go Build
    // ========================================

    // Build Go binary (without CGo by default)
    const go_build = b.addSystemCommand(&.{
        "go",
        "build",
        "-o",
        "zig-out/bin/chop-go",
        "./main.go",
    });
    go_build.setEnvironmentVariable("CGO_ENABLED", "0");

    const go_step = b.step("go", "Build Go application");
    go_step.dependOn(&go_build.step);

    // Run the Go application
    const go_run = b.addSystemCommand(&.{"zig-out/bin/chop-go"});
    go_run.step.dependOn(&go_build.step);
    if (b.args) |args| {
        go_run.addArgs(args);
    }

    const run_step = b.step("run", "Run the Go application");
    run_step.dependOn(&go_run.step);

    // Go tests (without CGo by default)
    const go_test = b.addSystemCommand(&.{
        "go",
        "test",
        "./...",
    });
    go_test.setEnvironmentVariable("CGO_ENABLED", "0");

    const go_test_step = b.step("go-test", "Run Go tests");
    go_test_step.dependOn(&go_test.step);

    // ========================================
    // Unified Build Steps
    // ========================================

    // Build all: Go binary and guillotine-mini
    const build_all = b.step("all", "Build everything (Go and guillotine-mini)");
    build_all.dependOn(guillotine_step);    // guillotine-mini WASM
    build_all.dependOn(go_step);            // Go binary

    // Make default install step also build Go and guillotine
    b.getInstallStep().dependOn(go_step);
    b.getInstallStep().dependOn(guillotine_step);

    // ========================================
    // Tests
    // ========================================

    const test_step = b.step("test", "Run all tests (Go only)");
    test_step.dependOn(go_test_step);

    // ========================================
    // Clean Step
    // ========================================

    const clean_zig = b.addSystemCommand(&.{
        "rm",
        "-rf",
        "zig-out",
        "zig-cache",
        ".zig-cache",
    });

    const clean_step = b.step("clean", "Remove all build artifacts");
    clean_step.dependOn(&clean_zig.step);
}
