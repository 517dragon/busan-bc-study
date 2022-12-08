/*
SPDX-License-Identifier: Apache-2.0
*/

package main

import (
	"encoding/json"
	"fmt"
	"time"
	"log"

	"github.com/golang/protobuf/ptypes"
	"github.com/hyperledger/fabric-contract-api-go/contractapi" // hyperledger fabric chaincode GO SDK
)

type SmartContract struct {  // SmartContract 객체중 구조체
	contractapi.Contract // 상속
}

type Career struct { // world state 에 value 에 JSON으로 marshal 되어 저장될 구조체
	ProjectId	string	`json:"projectId"`
	ProjectName	string	`json:"projectName"`
	Period		string	`json:"period"`
	Company		string	`json:"company"`
	Position	string	`json:"position"`
	Role		string	`json:"role"`
	Status		string	`json:"status"` //request(요청), approval(승인), return(거부, 반려)
}

type QueryResult struct { // queryallcars 에서 검색된 K, V 쌍들을 배열로 만들기 위해 사용되는 검색결과 구조체
	Key    string `json:"Key"`
	Record *Career
}

// History 결과저장을 위한 구조체
type HistoryQueryResult struct{
	Record 		*Career		`json:"record"`
	TxId		string		`json:"txId"`
	Timestamp 	time.Time	`json:"timestamp"`
	IsDelete	bool		`json:"isDelete"`
}

func (s *SmartContract) CreateCareer(ctx contractapi.TransactionContextInterface,
	projectId string, projectName string, period string, company string, position string, role string) error { // 매개변수 5개 넣어주는 주체는? endorser <= application(submitTransaction("CreateCar","CAR10","BMW","420D", "white", "bstudent"))
	
	// (TO DO) 오류검증 - 각 매개변수안에 유효값이 들어있는지 검사 

	career := Career{
		ProjectId: projectId,
		ProjectName:   projectName,
		Period:  period,
		Company: company,
		Position:  position,
		Role:  role,
		Status:  "request",
	}

	careerAsBytes, _ := json.Marshal(career) // 생성한 구조체 Marshal ( 직렬화 )

	return ctx.GetStub().PutState(projectId, careerAsBytes)
	// value: JSON format
	// endorser peer 반환 -> 서명 -> APP -> orderer -> commiter 동기화
}

func (s *SmartContract) QueryCareer(ctx contractapi.TransactionContextInterface, projectId string) (*Career, error) { // application - evaluateTransaction("QueryCar", "CAR10")
	careerAsBytes, err := ctx.GetStub().GetState(projectId) // state -> JSON format []byte

	if err != nil { // GetState, GetStub, ctx참조가 오류를 만났을때
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if careerAsBytes == nil { // key가 저장된적이 없다 or delete된 경우
		return nil, fmt.Errorf("%s does not exist", projectId)
	}

	// 정상적으로 조회가 된 경우
	career := new(Career) // 객체화 JSON -> 구조체
	_ = json.Unmarshal(careerAsBytes, career) // call by REFERENCE

	return career, nil
}

func (s *SmartContract) QueryAllCareer(ctx contractapi.TransactionContextInterface) ([]QueryResult, error) {
	startKey := ""  // CAR0
	endKey := ""	// CAR9

	resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey) // state를 범위로 검색하는 함수

	if err != nil { // GetStub, GetStateByRange 오류를 가지느냐?
		return nil, err
	}

	defer resultsIterator.Close() // defer 함수 끝났을때 예약

	results := []QueryResult{} 

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()

		if err != nil { // Next가 오류가 있는지
			return nil, err
		}

		career := new(Career) // Car JSON 형식
		_ = json.Unmarshal(queryResponse.Value, career)

		queryResult := QueryResult{Key: queryResponse.Key, Record: career}
		results = append(results, queryResult)
	}

	return results, nil
}

// 승인 검토
func (s *SmartContract) ChangeStatus(ctx contractapi.TransactionContextInterface, projectId string, status string) error { // application - submitTransaction("ChangeCarOwner", "CAR10", "blockchain")
	
	career, err := s.QueryCareer(ctx, projectId)

	if err != nil {
		return err
	}
	// 검증 생략 -- 이전 소유자에서 전달되었는지 유효한지

	// 승인 검토
	career.Status = status

	careerAsBytes, _ := json.Marshal(career) // 직렬화 ( 구조체 -> JSON 포멧의 Byte[] )

	return ctx.GetStub().PutState(projectId, careerAsBytes)
}

// 7. GetHistory upgrade
func (t *SmartContract) GetHistory(ctx contractapi.TransactionContextInterface, projectId string) ([]HistoryQueryResult, error) {
	log.Printf("GetAssetHistory: ID %v", projectId) // 체인코드 컨테이너 -> docker logs dev-asset1...

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(projectId)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var career Career
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &career)
			if err != nil {
				return nil, err
			}
		} else {
			career = Career{}
		}

		timestamp, err := ptypes.Timestamp(response.Timestamp)
		if err != nil {
			return nil, err
		}

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: timestamp,
			Record:    &career,
			IsDelete:  response.IsDelete,
		}
		records = append(records, record)
	}

	return records, nil
}

func main() {

	chaincode, err := contractapi.NewChaincode(new(SmartContract))

	if err != nil {
		fmt.Printf("Error create fabcar chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting fabcar chaincode: %s", err.Error())
	}
}