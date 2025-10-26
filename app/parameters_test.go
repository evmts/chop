package app

import (
	"chop/config"
	"chop/types"
	"testing"
)

// TestNewCallParameters tests the NewCallParameters function
func TestNewCallParameters(t *testing.T) {
	t.Parallel()

	params := NewCallParameters()

	// Test that all fields are initialized
	if params.CallType == "" {
		t.Error("Expected CallType to be initialized")
	}
	if params.Caller == "" {
		t.Error("Expected Caller to be initialized")
	}
	if params.Target == "" {
		t.Error("Expected Target to be initialized")
	}
	if params.Value == "" {
		t.Error("Expected Value to be initialized")
	}
	if params.InputData == "" {
		t.Error("Expected InputData to be initialized")
	}
	if params.GasLimit == "" {
		t.Error("Expected GasLimit to be initialized")
	}
	if params.Salt == "" {
		t.Error("Expected Salt to be initialized")
	}

	// Test that GasLimit is set to the default
	if params.GasLimit != config.DefaultGasLimit {
		t.Errorf("Expected GasLimit to be %s, got %s", config.DefaultGasLimit, params.GasLimit)
	}

	// Test that CallType is one of the valid options
	validCallTypes := types.GetCallTypeOptions()
	found := false
	for _, ct := range validCallTypes {
		if params.CallType == ct {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("CallType %s is not a valid call type", params.CallType)
	}
}

// TestGetCallParams tests the GetCallParams function
func TestGetCallParams(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		callType       string
		expectedCount  int
		shouldHaveTarget bool
		shouldHaveValue  bool
		shouldHaveSalt   bool
	}{
		{
			name:           "CALL has all standard params",
			callType:       "CALL",
			expectedCount:  6, // CallType, Caller, Target, Value, GasLimit, Input
			shouldHaveTarget: true,
			shouldHaveValue:  true,
			shouldHaveSalt:   false,
		},
		{
			name:           "STATICCALL has no Value",
			callType:       "STATICCALL",
			expectedCount:  5, // CallType, Caller, Target, GasLimit, Input (no Value)
			shouldHaveTarget: true,
			shouldHaveValue:  false,
			shouldHaveSalt:   false,
		},
		{
			name:           "CREATE has no Target",
			callType:       "CREATE",
			expectedCount:  5, // CallType, Caller, Value, GasLimit, Input (no Target)
			shouldHaveTarget: false,
			shouldHaveValue:  true,
			shouldHaveSalt:   false,
		},
		{
			name:           "CREATE2 has Salt but no Target",
			callType:       "CREATE2",
			expectedCount:  6, // CallType, Caller, Value, GasLimit, Input, Salt (no Target)
			shouldHaveTarget: false,
			shouldHaveValue:  true,
			shouldHaveSalt:   true,
		},
		{
			name:           "DELEGATECALL has Target and Value",
			callType:       "DELEGATECALL",
			expectedCount:  6, // CallType, Caller, Target, Value, GasLimit, Input
			shouldHaveTarget: true,
			shouldHaveValue:  true,
			shouldHaveSalt:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cp := types.CallParametersStrings{
				CallType:  tt.callType,
				Caller:    "0x1234",
				Target:    "0x5678",
				Value:     "100",
				InputData: "0xabcd",
				GasLimit:  "1000000",
				Salt:      "0x1111",
			}

			params := GetCallParams(cp)

			if len(params) != tt.expectedCount {
				t.Errorf("Expected %d parameters, got %d", tt.expectedCount, len(params))
			}

			// Check for Target parameter
			hasTarget := false
			for _, p := range params {
				if p.Name == config.CallParamTarget {
					hasTarget = true
					break
				}
			}
			if hasTarget != tt.shouldHaveTarget {
				t.Errorf("Expected Target parameter presence to be %v, got %v", tt.shouldHaveTarget, hasTarget)
			}

			// Check for Value parameter
			hasValue := false
			for _, p := range params {
				if p.Name == config.CallParamValue {
					hasValue = true
					break
				}
			}
			if hasValue != tt.shouldHaveValue {
				t.Errorf("Expected Value parameter presence to be %v, got %v", tt.shouldHaveValue, hasValue)
			}

			// Check for Salt parameter
			hasSalt := false
			for _, p := range params {
				if p.Name == config.CallParamSalt {
					hasSalt = true
					break
				}
			}
			if hasSalt != tt.shouldHaveSalt {
				t.Errorf("Expected Salt parameter presence to be %v, got %v", tt.shouldHaveSalt, hasSalt)
			}

			// All call types should have CallType parameter
			hasCallType := false
			for _, p := range params {
				if p.Name == config.CallParamCallType {
					hasCallType = true
					break
				}
			}
			if !hasCallType {
				t.Error("Expected CallType parameter to always be present")
			}

			// All call types should have Caller parameter
			hasCaller := false
			for _, p := range params {
				if p.Name == config.CallParamCaller {
					hasCaller = true
					break
				}
			}
			if !hasCaller {
				t.Error("Expected Caller parameter to always be present")
			}

			// All call types should have GasLimit parameter
			hasGasLimit := false
			for _, p := range params {
				if p.Name == config.CallParamGasLimit {
					hasGasLimit = true
					break
				}
			}
			if !hasGasLimit {
				t.Error("Expected GasLimit parameter to always be present")
			}

			// All call types should have Input parameter (or InputDeploy for CREATE/CREATE2)
			hasInput := false
			for _, p := range params {
				if p.Name == config.CallParamInput || p.Name == config.CallParamInputDeploy {
					hasInput = true
					break
				}
			}
			if !hasInput {
				t.Error("Expected Input/InputDeploy parameter to always be present")
			}
		})
	}
}

// TestSetCallParam tests the SetCallParam function
func TestSetCallParam(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		paramName string
		setValue  string
		checkFunc func(*types.CallParametersStrings) string
	}{
		{
			name:      "Set CallType",
			paramName: config.CallParamCallType,
			setValue:  "STATICCALL",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.CallType },
		},
		{
			name:      "Set Caller",
			paramName: config.CallParamCaller,
			setValue:  "0x1234567890abcdef1234567890abcdef12345678",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.Caller },
		},
		{
			name:      "Set Target",
			paramName: config.CallParamTarget,
			setValue:  "0xabcdef1234567890abcdef1234567890abcdef12",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.Target },
		},
		{
			name:      "Set Value",
			paramName: config.CallParamValue,
			setValue:  "1000000000000000000",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.Value },
		},
		{
			name:      "Set GasLimit",
			paramName: config.CallParamGasLimit,
			setValue:  "5000000",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.GasLimit },
		},
		{
			name:      "Set Input",
			paramName: config.CallParamInput,
			setValue:  "0x1234abcd",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.InputData },
		},
		{
			name:      "Set InputDeploy",
			paramName: config.CallParamInputDeploy,
			setValue:  "0x608060405234801561001057600080fd5b50",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.InputData },
		},
		{
			name:      "Set Salt",
			paramName: config.CallParamSalt,
			setValue:  "0x0000000000000000000000000000000000000000000000000000000000000001",
			checkFunc: func(cp *types.CallParametersStrings) string { return cp.Salt },
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cp := NewCallParameters()
			SetCallParam(&cp, tt.paramName, tt.setValue)

			actualValue := tt.checkFunc(&cp)
			if actualValue != tt.setValue {
				t.Errorf("Expected %s to be %s, got %s", tt.paramName, tt.setValue, actualValue)
			}
		})
	}
}

// TestSetCallParamMultiple tests setting multiple parameters
func TestSetCallParamMultiple(t *testing.T) {
	t.Parallel()

	cp := NewCallParameters()

	// Set multiple parameters
	SetCallParam(&cp, config.CallParamCallType, "CREATE")
	SetCallParam(&cp, config.CallParamCaller, "0xCALLER")
	SetCallParam(&cp, config.CallParamValue, "500")
	SetCallParam(&cp, config.CallParamGasLimit, "2000000")
	SetCallParam(&cp, config.CallParamInput, "0xBYTECODE")

	// Verify all changes
	if cp.CallType != "CREATE" {
		t.Errorf("Expected CallType to be CREATE, got %s", cp.CallType)
	}
	if cp.Caller != "0xCALLER" {
		t.Errorf("Expected Caller to be 0xCALLER, got %s", cp.Caller)
	}
	if cp.Value != "500" {
		t.Errorf("Expected Value to be 500, got %s", cp.Value)
	}
	if cp.GasLimit != "2000000" {
		t.Errorf("Expected GasLimit to be 2000000, got %s", cp.GasLimit)
	}
	if cp.InputData != "0xBYTECODE" {
		t.Errorf("Expected InputData to be 0xBYTECODE, got %s", cp.InputData)
	}
}

// TestGetCallParamsInputNameChange tests that Input parameter name changes for CREATE/CREATE2
func TestGetCallParamsInputNameChange(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		callType          string
		expectedInputName string
	}{
		{
			name:              "CALL uses Input",
			callType:          "CALL",
			expectedInputName: config.CallParamInput,
		},
		{
			name:              "CREATE uses InputDeploy",
			callType:          "CREATE",
			expectedInputName: config.CallParamInputDeploy,
		},
		{
			name:              "CREATE2 uses InputDeploy",
			callType:          "CREATE2",
			expectedInputName: config.CallParamInputDeploy,
		},
		{
			name:              "STATICCALL uses Input",
			callType:          "STATICCALL",
			expectedInputName: config.CallParamInput,
		},
		{
			name:              "DELEGATECALL uses Input",
			callType:          "DELEGATECALL",
			expectedInputName: config.CallParamInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cp := types.CallParametersStrings{
				CallType:  tt.callType,
				Caller:    "0x1234",
				Target:    "0x5678",
				Value:     "100",
				InputData: "0xabcd",
				GasLimit:  "1000000",
				Salt:      "0x1111",
			}

			params := GetCallParams(cp)

			// Find the input parameter
			var inputParam *types.CallParameter
			for i, p := range params {
				if p.Name == config.CallParamInput || p.Name == config.CallParamInputDeploy {
					inputParam = &params[i]
					break
				}
			}

			if inputParam == nil {
				t.Fatal("Input parameter not found")
			}

			if inputParam.Name != tt.expectedInputName {
				t.Errorf("Expected input parameter name to be %s, got %s", tt.expectedInputName, inputParam.Name)
			}
		})
	}
}

// TestGetCallParamsOrder tests that parameters are returned in consistent order
func TestGetCallParamsOrder(t *testing.T) {
	t.Parallel()

	cp := types.CallParametersStrings{
		CallType:  "CALL",
		Caller:    "0x1234",
		Target:    "0x5678",
		Value:     "100",
		InputData: "0xabcd",
		GasLimit:  "1000000",
		Salt:      "0x1111",
	}

	params := GetCallParams(cp)

	// Expected order: CallType, Caller, Target, Value, GasLimit, Input
	expectedOrder := []string{
		config.CallParamCallType,
		config.CallParamCaller,
		config.CallParamTarget,
		config.CallParamValue,
		config.CallParamGasLimit,
		config.CallParamInput,
	}

	if len(params) != len(expectedOrder) {
		t.Fatalf("Expected %d parameters, got %d", len(expectedOrder), len(params))
	}

	for i, expected := range expectedOrder {
		if params[i].Name != expected {
			t.Errorf("Expected parameter %d to be %s, got %s", i, expected, params[i].Name)
		}
	}
}

// TestGetCallParamsValues tests that parameter values are preserved
func TestGetCallParamsValues(t *testing.T) {
	t.Parallel()

	cp := types.CallParametersStrings{
		CallType:  "DELEGATECALL",
		Caller:    "0xCALLER123",
		Target:    "0xTARGET456",
		Value:     "999",
		InputData: "0xDATA",
		GasLimit:  "3000000",
		Salt:      "0xSALT",
	}

	params := GetCallParams(cp)

	// Create a map for easy lookup
	paramMap := make(map[string]string)
	for _, p := range params {
		paramMap[p.Name] = p.Value
	}

	// Verify values
	if paramMap[config.CallParamCallType] != "DELEGATECALL" {
		t.Errorf("Expected CallType value to be DELEGATECALL, got %s", paramMap[config.CallParamCallType])
	}
	if paramMap[config.CallParamCaller] != "0xCALLER123" {
		t.Errorf("Expected Caller value to be 0xCALLER123, got %s", paramMap[config.CallParamCaller])
	}
	if paramMap[config.CallParamTarget] != "0xTARGET456" {
		t.Errorf("Expected Target value to be 0xTARGET456, got %s", paramMap[config.CallParamTarget])
	}
	if paramMap[config.CallParamValue] != "999" {
		t.Errorf("Expected Value value to be 999, got %s", paramMap[config.CallParamValue])
	}
	if paramMap[config.CallParamGasLimit] != "3000000" {
		t.Errorf("Expected GasLimit value to be 3000000, got %s", paramMap[config.CallParamGasLimit])
	}
	if paramMap[config.CallParamInput] != "0xDATA" {
		t.Errorf("Expected Input value to be 0xDATA, got %s", paramMap[config.CallParamInput])
	}
}

// TestSetCallParamEmptyValue tests setting empty values
func TestSetCallParamEmptyValue(t *testing.T) {
	t.Parallel()

	cp := NewCallParameters()

	// Set to empty string
	SetCallParam(&cp, config.CallParamValue, "")
	if cp.Value != "" {
		t.Errorf("Expected Value to be empty, got %s", cp.Value)
	}

	SetCallParam(&cp, config.CallParamInput, "")
	if cp.InputData != "" {
		t.Errorf("Expected InputData to be empty, got %s", cp.InputData)
	}
}

// TestSetCallParamUnknown tests setting unknown parameter (should be a no-op)
func TestSetCallParamUnknown(t *testing.T) {
	t.Parallel()

	cp := NewCallParameters()
	originalCP := cp

	// Set unknown parameter
	SetCallParam(&cp, "UnknownParam", "SomeValue")

	// Verify nothing changed
	if cp != originalCP {
		t.Error("Setting unknown parameter should not modify the struct")
	}
}
