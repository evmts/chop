package main

import (
	"chop/internal/app"
	"fmt"
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/urfave/cli/v2"
)

func runTUI(c *cli.Context) error {
	p := tea.NewProgram(
		app.InitialModel(),
		tea.WithAltScreen(),
	)
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running program: %w", err)
	}
	return nil
}

func main() {
	cliApp := &cli.App{
		Name:    "chop",
		Usage:   "Guillotine EVM CLI - Interactive EVM execution environment",
		Version: "0.1.0",
		Action:  runTUI,
		Commands: []*cli.Command{
			{
				Name:    "run",
				Aliases: []string{"r"},
				Usage:   "Run the Guillotine EVM (launches TUI)",
				Action:  runTUI,
			},
			{
				Name:    "build",
				Aliases: []string{"b"},
				Usage:   "Build the Guillotine library",
				Action: func(c *cli.Context) error {
					fmt.Println("Building Guillotine library...")
					// TODO: Build guillotine-mini submodule
					return nil
				},
			},
		},
	}

	if err := cliApp.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
