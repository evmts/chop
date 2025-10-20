package evm

import (
	"chop/types"
)

// VMManager manages the EVM instance (stubbed for now)
type VMManager struct {
	// TODO: Will hold reference to guillotine VM
}

// GetVMManager creates a new VM manager
func GetVMManager() (*VMManager, error) {
	// TODO: Initialize guillotine VM here
	return &VMManager{}, nil
}

// Close cleans up the VM manager
func (vm *VMManager) Close() {
	// TODO: Cleanup guillotine VM
}

// ExecuteCall executes an EVM call with the given parameters
func ExecuteCall(vm *VMManager, params types.CallParametersStrings) (*types.CallResult, error) {
	// TODO: Implement actual EVM execution using guillotine
	// For now, return a stubbed successful result

	result := &types.CallResult{
		Success:    true,
		ReturnData: []byte{0x00, 0x00, 0x00, 0x01},
		GasLeft:    29000000,
		ErrorInfo:  "",
		Logs:       []types.Log{},
	}

	// For CREATE/CREATE2, return a deployed address
	if params.CallType == "CREATE" || params.CallType == "CREATE2" {
		result.DeployedAddr = "0x0000000000000000000000000000000000001234"
	}

	return result, nil
}

// CallValidator validates call parameters
type CallValidator struct{}

// NewCallValidator creates a new call validator
func NewCallValidator() *CallValidator {
	return &CallValidator{}
}

// ValidateField validates a single field
func (cv *CallValidator) ValidateField(field, value string) error {
	switch field {
	case "Caller", "Target":
		if len(value) != 42 || value[:2] != "0x" {
			return types.InputParamError{
				Field:   field,
				Message: "Invalid address format",
				Details: "Address must be 42 characters starting with 0x",
			}
		}
	case "Value", "Gas Limit":
		if value == "" {
			return types.InputParamError{
				Field:   field,
				Message: "Value cannot be empty",
			}
		}
	case "Input Data", "Bytecode":
		if len(value) < 2 || value[:2] != "0x" {
			return types.InputParamError{
				Field:   field,
				Message: "Invalid hex format",
				Details: "Data must start with 0x",
			}
		}
	case "Salt":
		if len(value) != 66 || value[:2] != "0x" {
			return types.InputParamError{
				Field:   field,
				Message: "Invalid salt format",
				Details: "Salt must be 66 characters starting with 0x",
			}
		}
	}
	return nil
}

// ValidateCallParameters validates all call parameters
func (cv *CallValidator) ValidateCallParameters(params types.CallParametersStrings) error {
	if err := cv.ValidateField("Caller", params.Caller); err != nil {
		return err
	}

	// Target not needed for CREATE/CREATE2
	if params.CallType != "CREATE" && params.CallType != "CREATE2" {
		if err := cv.ValidateField("Target", params.Target); err != nil {
			return err
		}
	}

	if err := cv.ValidateField("Gas Limit", params.GasLimit); err != nil {
		return err
	}

	if err := cv.ValidateField("Input Data", params.InputData); err != nil {
		return err
	}

	// Value not needed for STATICCALL
	if params.CallType != "STATICCALL" {
		if err := cv.ValidateField("Value", params.Value); err != nil {
			return err
		}
	}

	// Salt only for CREATE2
	if params.CallType == "CREATE2" {
		if err := cv.ValidateField("Salt", params.Salt); err != nil {
			return err
		}
	}

	return nil
}
