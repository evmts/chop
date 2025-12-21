const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // ========================================
    // Dependencies
    // ========================================

    const libvaxis_dep = b.dependency("libvaxis", .{
        .target = target,
        .optimize = optimize,
    });

    const guillotine_dep = b.dependency("guillotine", .{
        .target = target,
        .optimize = optimize,
    });

    // ========================================
    // Chop TUI Executable
    // ========================================

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Add libvaxis module
    exe_mod.addImport("vaxis", libvaxis_dep.module("vaxis"));

    // Add guillotine EVM module
    if (guillotine_dep.builder.modules.get("evm")) |evm_mod| {
        exe_mod.addImport("evm", evm_mod);
    }
    if (guillotine_dep.builder.modules.get("primitives")) |primitives_mod| {
        exe_mod.addImport("primitives", primitives_mod);
    }

    const exe = b.addExecutable(.{
        .name = "chop",
        .root_module = exe_mod,
    });

    b.installArtifact(exe);

    // ========================================
    // Run Step
    // ========================================

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the Chop TUI");
    run_step.dependOn(&run_cmd.step);

    // ========================================
    // Tests
    // ========================================

    const unit_tests = b.addTest(.{
        .root_module = exe_mod,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    // ========================================
    // Clean Step
    // ========================================

    const clean = b.addSystemCommand(&.{
        "rm",
        "-rf",
        "zig-out",
        ".zig-cache",
    });

    const clean_step = b.step("clean", "Remove build artifacts");
    clean_step.dependOn(&clean.step);
}
