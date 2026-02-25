Source demos/theme.tape
Output demos/cli-overview.gif

# CLI Overview
# Show help, version, and a few key commands

Sleep 500ms

Type "chop --help"
Enter
Sleep 3s

Type "chop --version"
Enter
Sleep 2s

Type 'chop keccak "transfer(address,uint256)"'
Enter
Sleep 2s

Type 'chop sig "transfer(address,uint256)"'
Enter
Sleep 2s

Type "chop to-hex 255"
Enter
Sleep 2s

Type "chop from-wei 1000000000000000000"
Enter
Sleep 2s

Sleep 1s
