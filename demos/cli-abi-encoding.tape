Source demos/theme.tape
Output demos/cli-abi-encoding.gif

# ABI Encoding and Decoding
# Demonstrate abi-encode, calldata, and calldata-decode commands

Sleep 500ms

Type 'chop abi-encode "transfer(address,uint256)" 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000'
Enter
Sleep 3s

Type 'chop calldata "transfer(address,uint256)" 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000000000000000000'
Enter
Sleep 3s

Type 'chop calldata-decode "transfer(address,uint256)" 0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000003e8'
Enter
Sleep 3s

Sleep 1s
