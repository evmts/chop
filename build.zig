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

    const go_step = b.step("go", "Build Go application (CGo disabled, stub EVM)");
    go_step.dependOn(&go_build.step);

    // Run the Go application
    const go_run = b.addSystemCommand(&.{"zig-out/bin/chop-go"});
    go_run.step.dependOn(&go_build.step);
    if (b.args) |args| {
        go_run.addArgs(args);
    }

    const run_step = b.step("run", "Run the Go application (stub EVM)");
    run_step.dependOn(&go_run.step);

    // ========================================
    // CGo-Enabled Build (Real EVM)
    // ========================================

    // Build guillotine-mini native library (for CGo)
    const guillotine_lib_build = b.addSystemCommand(&.{
        "zig",
        "build",
        "lib",
        "-Doptimize=ReleaseFast",
    });
    guillotine_lib_build.setCwd(b.path("lib/guillotine-mini"));

    const guillotine_lib_step = b.step("guillotine-lib", "Build guillotine-mini native library for CGo");
    guillotine_lib_step.dependOn(&guillotine_lib_build.step);

    // Build Go binary WITH CGo (requires guillotine-mini native lib)
    const go_build_cgo = b.addSystemCommand(&.{
        "go",
        "build",
        "-o",
        "zig-out/bin/chop",
        "-tags",
        "cgo",
        "./main.go",
    });
    go_build_cgo.setEnvironmentVariable("CGO_ENABLED", "1");
    go_build_cgo.step.dependOn(&guillotine_lib_build.step); // Ensure lib built first

    const go_cgo_step = b.step("go-cgo", "Build Go application with CGo (real EVM execution)");
    go_cgo_step.dependOn(&go_build_cgo.step);

    // Run the CGo-enabled Go application
    const go_run_cgo = b.addSystemCommand(&.{"zig-out/bin/chop"});
    go_run_cgo.step.dependOn(&go_build_cgo.step);
    if (b.args) |args| {
        go_run_cgo.addArgs(args);
    }

    const run_cgo_step = b.step("run-cgo", "Run the Go application with real EVM");
    run_cgo_step.dependOn(&go_run_cgo.step);

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
