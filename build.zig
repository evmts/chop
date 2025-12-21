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

    const voltaire_dep = b.dependency("voltaire", .{
        .target = target,
        .optimize = optimize,
    });

    const clap_dep = b.dependency("clap", .{
        .target = target,
        .optimize = optimize,
    });

    // ========================================
    // Build Options for EVM
    // ========================================

    const build_options = b.addOptions();
    build_options.addOption(bool, "enable_tracing", false);
    build_options.addOption(bool, "disable_tailcall_dispatch", true);
    build_options.addOption([]const u8, "hardfork", "CANCUN");
    build_options.addOption(bool, "disable_gas_checks", false);
    build_options.addOption(bool, "enable_fusion", true);
    build_options.addOption([]const u8, "optimize_strategy", "safe");
    build_options.addOption(u11, "max_call_depth", 1024);
    build_options.addOption(u12, "stack_size", 1024);
    build_options.addOption(u32, "max_bytecode_size", 24576);
    build_options.addOption(u32, "max_initcode_size", 49152);
    build_options.addOption(u64, "block_gas_limit", 30_000_000);
    build_options.addOption(usize, "memory_initial_capacity", 4096);
    build_options.addOption(u64, "memory_limit", 0xFFFFFF);
    build_options.addOption(usize, "arena_capacity_limit", 64 * 1024 * 1024);
    build_options.addOption(bool, "disable_balance_checks", false);
    const options_mod = build_options.createModule();

    // ========================================
    // Voltaire Primitives & Crypto Modules
    // ========================================

    const primitives_mod = voltaire_dep.module("primitives");
    const crypto_mod = voltaire_dep.module("crypto");
    const precompiles_mod = voltaire_dep.module("precompiles");
    const clap_mod = clap_dep.module("clap");

    // ========================================
    // Guillotine EVM Module (local path)
    // ========================================

    const evm_mod = b.createModule(.{
        .root_source_file = b.path("guillotine/src/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    evm_mod.addImport("primitives", primitives_mod);
    evm_mod.addImport("crypto", crypto_mod);
    evm_mod.addImport("precompiles", precompiles_mod);
    evm_mod.addImport("build_options", options_mod);

    // ========================================
    // Chop CLI/TUI Executable
    // ========================================

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Add libvaxis module (for TUI)
    exe_mod.addImport("vaxis", libvaxis_dep.module("vaxis"));

    // Add clap module (for CLI)
    exe_mod.addImport("clap", clap_mod);

    // Add EVM modules
    exe_mod.addImport("evm", evm_mod);
    exe_mod.addImport("primitives", primitives_mod);
    exe_mod.addImport("crypto", crypto_mod);

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
