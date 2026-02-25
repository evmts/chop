Source demos/theme.tape
Output demos/cli-conversions.gif

# Data Conversions
# Demonstrate hex, decimal, wei, bytes32, and utf8 conversions

Sleep 500ms

Type "chop to-hex 255"
Enter
Sleep 2s

Type "chop to-dec 0xff"
Enter
Sleep 2s

Type "chop from-wei 1500000000000000000"
Enter
Sleep 2s

Type "chop to-wei 1.5"
Enter
Sleep 2s

Type "chop to-bytes32 0x1234"
Enter
Sleep 2s

Type 'chop from-utf8 "hello"'
Enter
Sleep 2s

Type "chop to-utf8 0x68656c6c6f"
Enter
Sleep 2s

Sleep 1s
