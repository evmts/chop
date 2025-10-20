const std = @import("std");

pub fn build(b: *std.Build) void {
    // Check if guillotine-mini submodule is initialized
    const submodule_path = "lib/guillotine-mini/build.zig";
    _ = std.fs.cwd().statFile(submodule_path) catch {
        std.debug.print("Error: guillotine-mini submodule not initialized\n", .{});
        std.debug.print("Run: git submodule update --init --recursive\n", .{});
        std.process.exit(1);
    };


    // ========================================
    // Guillotine-mini Submodule Build
    // ========================================

    // Build guillotine-mini WASM library
    const guillotine_build = b.addSystemCommand(&.{
        "zig",
        "build",
        "wasm",
        "-Doptimize=ReleaseSmall",
    });
    guillotine_build.setCwd(b.path("lib/guillotine-mini"));

    const guillotine_step = b.step("guillotine", "Build guillotine-mini WASM library");
    guillotine_step.dependOn(&guillotine_build.step);

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
    });

    const clean_guillotine = b.addSystemCommand(&.{
        "sh",
        "-c",
        "cd lib/guillotine-mini && rm -rf zig-out zig-cache",
    });

    const clean_step = b.step("clean", "Remove all build artifacts");
    clean_step.dependOn(&clean_zig.step);
    clean_step.dependOn(&clean_guillotine.step);
}
