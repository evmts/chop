const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // ========================================
    // Chop Module (our Zig code)
    // ========================================
    const chop_mod = b.addModule("chop", .{
        .root_source_file = b.path("evm/root.zig"),
        .target = target,
    });

    // ========================================
    // Chop Executable
    // ========================================
    const exe = b.addExecutable(.{
        .name = "chop",
        .root_module = b.createModule(.{
            .root_source_file = b.path("evm/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "chop", .module = chop_mod },
            },
        }),
    });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the chop app");
    run_step.dependOn(&run_cmd.step);

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

    // Build Go binary
    const go_build = b.addSystemCommand(&.{
        "go",
        "build",
        "-o",
        "zig-out/bin/chop-go",
        "./main.go",
    });

    const go_step = b.step("go", "Build Go application");
    go_step.dependOn(&go_build.step);

    // Go tests
    const go_test = b.addSystemCommand(&.{
        "go",
        "test",
        "./...",
    });

    const go_test_step = b.step("go-test", "Run Go tests");
    go_test_step.dependOn(&go_test.step);

    // ========================================
    // Unified Build Steps
    // ========================================

    // Build all: Zig executable, Go binary, and guillotine-mini
    const build_all = b.step("all", "Build everything (Zig, Go, and guillotine-mini)");
    build_all.dependOn(&exe.step);          // Zig executable
    build_all.dependOn(guillotine_step);    // guillotine-mini WASM
    build_all.dependOn(go_step);            // Go binary

    // Make default install step also build Go and guillotine
    b.getInstallStep().dependOn(go_step);
    b.getInstallStep().dependOn(guillotine_step);

    // ========================================
    // Tests
    // ========================================

    // Zig tests
    const chop_tests = b.addTest(.{
        .root_module = chop_mod,
    });
    const run_chop_tests = b.addRunArtifact(chop_tests);

    const exe_tests = b.addTest(.{
        .root_module = exe.root_module,
    });
    const run_exe_tests = b.addRunArtifact(exe_tests);

    const test_step = b.step("test", "Run all tests (Zig and Go)");
    test_step.dependOn(&run_chop_tests.step);
    test_step.dependOn(&run_exe_tests.step);
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
