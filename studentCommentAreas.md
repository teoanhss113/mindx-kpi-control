### Request
```
fetch("https://lms-api.mindx.edu.vn/", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "authorization": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg2OGU0YWNlMGI2NTE2ZDM2YjlmNTZkZThjZTQ5Nzg4ZmNjZGFjNDMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiVEUgUGhhbiBOZ-G7jWMgSG_DoG5nIEFuaCIsImlkIjoiNWZmMjZiOWYzNzI5MjAwOTlkMjU4ODIzIiwidXNlcm5hbWUiOiJhbmhwbmgwMDEiLCJyb2xlcyI6WyI1ZmIzNzk4NTBkZGNjYTQ3OGU5M2RlZjgiXSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL21pbmR4LWVkdS1wcm9kIiwiYXVkIjoibWluZHgtZWR1LXByb2QiLCJhdXRoX3RpbWUiOjE3Nzg1NTM0ODIsInVzZXJfaWQiOiJaakVuTW9ha3FZVE1mNUdOdkVXZEl1OXlPRGEyIiwic3ViIjoiWmpFbk1vYWtxWVRNZjVHTnZFV2RJdTl5T0RhMiIsImlhdCI6MTc3ODU1NzIzMSwiZXhwIjoxNzc4NTYwODMxLCJlbWFpbCI6ImFuaHBuaEBtaW5keC5jb20udm4iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfbnVtYmVyIjoiKzg0MzY2NzU0MzQyIiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJhbmhwbmhAbWluZHguY29tLnZuIl0sInBob25lIjpbIis4NDM2Njc1NDM0MiJdfSwic2lnbl9pbl9wcm92aWRlciI6ImN1c3RvbSJ9fQ.aQT-4HQuN3tPveFWiIGkGugeKBxMcQFy0rzdSL35o2xZ8ap5e3K0xeIwLvuV37csAXTdR6ZRqjSqw7ouOstCRTtFlVJMiveD9cG8bIT8kQcbWllINUJZBHe-2PKjnFnEhnraxUlrLa6umuTZGNpTMXKVY287hsf_hjWH7cYRzZndLMhhTXvOeirmgPQ2RDb_CyozAUhTApnHAGUSxu52Pxv8-9uWbi_ejh4mIZLnnh74yX0P-P4E2MxG6SPHaFMwyMspJ8NO25PuZeUhwwxODsFlbN0LiiHz-LfS0eLb46L3mP6wTfPYbB2Ip5X7se8r4TmQebw10UGgxMlhBMG5mw",
    "content-language": "en",
    "content-type": "application/json",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "body": "{\"operationName\":\"studentCommentAreas\",\"variables\":{\"payload\":{\"filter\":{\"isActive_equals\":true,\"slots_in\":[\"1\"],\"type_in\":[\"CONTENT\",\"RATE\"]},\"pagination\":{\"paginationType\":\"NONE\"},\"orderBy\":\"sortOrder_DESC\"}},\"query\":\"query studentCommentAreas($payload: FindCommentAreasInput!) {\\n  studentCommentAreas(payload: $payload) {\\n    data {\\n      id\\n      name\\n      translations {\\n        key\\n        value\\n        locale\\n        __typename\\n      }\\n      fieldName\\n      type\\n      rates {\\n        value\\n        commentSamples\\n        __typename\\n      }\\n      checkpoint {\\n        gradeFrom\\n        gradeTo\\n        questions {\\n          question\\n          grade\\n          id\\n          __typename\\n        }\\n        __typename\\n      }\\n      isActive\\n      createdAt\\n      createdBy\\n      lastModifiedAt\\n      lastModifiedBy\\n      sortOrder\\n      slots\\n      isPublic\\n      isRequired\\n      guideline\\n      __typename\\n    }\\n    pagination {\\n      total\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\"}",
  "method": "POST"
});
```

### Response
```
{
    "data": {
        "studentCommentAreas": {
            "data": [
                {
                    "id": "66c4784c6ae1a9fab6321258",
                    "name": "[ART] Thái độ học tập trên lớp",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Thái độ học tập trên lớp",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024ThaiDộHọcTậpTrenLớp",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Học viên không tập trung suốt giờ học (mở các trang khác không phải bài học, làm việc riêng,...)"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Sự chú ý, tập trung trong bài học còn hạn chế, vẫn còn làm việc riêng trong lớp, cần giáo viên đưa sự tập trung trở lại\n- Có ý thức cho việc học trong lớp nhưng độ hợp tác chưa cao"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Học viên có chú ý nghe bài giảng nhưng hay bị ảnh hưởng bởi các bạn trong lớp hoặc hấp dẫn bởi các việc khác, vẫn cần nhắc nhở nhưng tần suất ít"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên chú ý lắng nghe bài giảng tốt, giáo viên ít phải nhắc nhở\n- Học viên chấp hành tốt các quy định, nội quy lớp học."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Học viên tập trung lắng nghe bài giảng, tự giác học tập, giáo viên hầu như không phải nhắc nhở con, hiệu quả buổi học cao\n- Học viên tuân thủ tuyệt đối các quy tắc trong lớp học, luôn có mặt đúng giờ, lễ phép khi giao tiếp với giáo viên."
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724151884806",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206519114",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 8,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c00060085161",
                    "name": "Thái độ học tập",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Thái độ học tập",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Thái độ học tập",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Thái độ học tập",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Con không tập trung suốt giờ học (mở các trang khác không phải bài học, làm việc riêng,...), không hợp tác trong lớp, dù giáo viên đã nhắc nhở nhiều"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Con thường xuyên mất tập trung, hay để giáo viên nhắc để quay lại bài, ngừng nhắc là làm việc riêng, chỉ hợp tác được 1 lúc ngắn"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Sự chú ý, tập trung trong bài học của con còn hạn chế, vẫn còn làm việc riêng trong lớp, cần giáo viên đưa sự tập trung trở lại. Có ý thức cho việc học trong lớp nhưng độ hợp tác chưa cao"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Cần chú ý nghe giảng và làm theo hiệu lệnh của giáo viên, con có hợp tác với thầy cô nhưng vẫn cần sao sát để đảm bảo không mất tập trung"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Có nghe bài giảng nhưng con hay bị ảnh hưởng bởi các bạn trong lớp hoặc hấp dẫn bới các việc khác, vẫn cần nhắc trên 5 lần 1 buổi"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 6,
                            "commentSamples": [
                                "Có lắng nghe bài giảng, đôi lúc xao nhẵng nhưng được nhắc thì sẽ quay lại bài giảng được, con vẫn cần nhắc trên 3 lần 1 buổi"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 7,
                            "commentSamples": [
                                "Chú ý lắng nghe bài giảng, tuy nhiên đôi lúc còn làm việc riêng trong lớp, khi con được nhắc sẽ quay lại bài học, nhắc dưới 3 lần 1 buổi"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 8,
                            "commentSamples": [
                                "Chú ý lắng nghe bài giảng khá tốt, giáo viên ít phải nhắc nhở, con chịu khó trao đổi bài học"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 9,
                            "commentSamples": [
                                "Tập trung lắng nghe bài giảng, tự giác học tập, giáo viên hầu như không phải nhắc nhở con, hiệu quả buổi học cao"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 10,
                            "commentSamples": [
                                "Thái độ học tập của con tốt, chú ý lắng nghe bài giảng, tuân thủ tuyệt đối các quy tắc trong lớp học, chăm chỉ trao đổi, có giúp đỡ các bạn trong lớp và thầy giáo hoàn thành buổi học"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022299",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936484826",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 7,
                    "slots": [
                        "1",
                        "final",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c477ef6ae1a9fab6320fc7",
                    "name": "[ART] Kỹ năng giao tiếp, hợp tác",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Kỹ năng giao tiếp, hợp tác",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024KỹNangGiaoTiếpHợpTac",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "- Học viên không có tương tác với giáo viên và không giao tiếp với các thành viên trong quá trình học.\n- Học viên chỉ tiếp nhận 1 chiều, không phản hồi và đưa ra ý kiến cá nhân."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Học viên có tương tác với giáo viên nhưng chỉ khi được hỏi, chưa có sự chủ động khi hoạt động thảo luận nhóm với bạn bè."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "- Học viên trình bày ý kiến với giáo viên khá tốt, chủ động hỏi khi gặp vấn đề, nhưng ngại phát biểu trước lớp\n- Học viên xác định được nhiệm vụ của nhóm và trách nhiệm của bản thân trong nhóm."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên có tinh thần tích cực khi thực hiện thảo luận, tương tác với giáo viên\n- Học viên biết quan tâm đến bạn bè, chia sẻ ý tưởng và không ngại thuyết trình trước lớp nhưng trình bày còn chưa mạch lạc"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Học viên trình bày ý kiến rõ ràng, chủ động hỏi khi gặp vấn đề, thuyết trình trước lớp mạch lạc, rõ ràng.\n- Học viên nhìn nhận được những ưu nhược điểm của bản thân sau khi nhận đánh giá từ giáo viên, bạn bè"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724151791085",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206535734",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 7,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c00060085177",
                    "name": "Tư duy, kỹ năng giải quyết vấn đề",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Tư duy, kỹ năng giải quyết vấn đề ",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Tư duy, kỹ năng giải quyết vấn đề ",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Tư duy, kỹ năng giải quyết vấn đề",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Con chưa biết cách phân tích đề bài và nhận biết vấn đề, chỉ làm được theo mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Nhận biết được vấn đề nhưng chưa biết cách phân tích, con chỉ có thể làm theo mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Phân tích vấn đề còn yếu: bắt đầu chia vấn đề lớn thành các vấn đề nhỏ hơn nhưng chưa hợp lý và logic, chỉ có thể làm theo mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Phân tích vấn đề còn yếu: con chia vấn đề lớn thành các vấn đề nhỏ có tính logic hơn 1 chút nhưng chưa hiệu quả, chủ yếu lặp lại làm theo mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Phân tích vấn đề rõ ràng hơn: chia vấn đề lớn thành các vấn đề nhỏ hơn hợp lý và logic, nhưng con vẫn chủ yếu lặp lại làm theo mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 6,
                            "commentSamples": [
                                "Biết phân tích vấn đề rõ ràng, điểm chung giữa các đề bài, bắt đầu tự đưa ra giải pháp của riêng mình nhưng giải pháp của con còn chưa logic và hiệu quả"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 7,
                            "commentSamples": [
                                "Phân tích vấn đề tốt, bắt đầu tự đưa ra giải pháp của riêng mình, giải pháp có tính logic nhưng con triển khai giải pháp còn yếu, có thể bắt tay vào giải quyết đề bài khác mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 8,
                            "commentSamples": [
                                "Phân tích vấn đề tốt, bắt đầu tự đưa ra giải pháp của riêng mình, giải pháp có tính logic, nhưng chưa biết thử đi thử lại nhiều lần đến khi ra kết quả, con bắt đầu làm được đề bài khác mẫu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 9,
                            "commentSamples": [
                                "Phân tích vấn đề tốt, bắt đầu tự đưa ra giải pháp của riêng mình, giải pháp có tính logic, biết thử đi thử lại nhiều lần đến khi ra kết quả, con làm được đề bài khác mẫu khá tốt"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 10,
                            "commentSamples": [
                                "Phân tích vấn đề tốt, bắt đầu tự đưa ra giải pháp của riêng mình, giải pháp có tính logic, biết thử đi thử lại nhiều lần đến khi ra kết quả, làm được đề bài khác mẫu tốt, con có thể tổng quát cho nhiều vấn đề tương tự sau này"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022431",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936409769",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 6,
                    "slots": [
                        "1",
                        "final",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "65123f566d84d7e245431e4a",
                    "name": "Kết quả học tập",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Kết quả học tập",
                            "locale": "en",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Kết quả học tập",
                            "locale": "vi",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Kết quả học tập",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1695694678371",
                    "createdBy": "63621e6d1872e177ea403644",
                    "lastModifiedAt": "1727936575993",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 5,
                    "slots": [
                        "final",
                        "1",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c0006008516c",
                    "name": "Thao tác chuột/ bàn phím",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Thao tác chuột/ bàn phím",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Thao tác chuột/ bàn phím",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Thao tác chuột/ bàn phím",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím còn rất chậm, con chưa biết sử dụng máy tính nhiều"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím còn rất chậm, con biết thao tác 1 số lệnh cơ bản của máy tính"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím còn chậm (gõ từng ngón tay), sử dụng được các lệnh trên phần mềm, con vẫn khó khăn theo tốc độ của thầy"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím còn chậm, biết dùng các phần mềm cơ bản của máy tính, con cố gắng thì đã theo kịp tốc độ của thầy"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím trung bình, con chưa sử dụng thành thạo 2 tay, biết dùng 1 số lệnh & phần mềm, nhưng theo kịp tốc độ của thầy"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 6,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím khá, chưa sử dụng thành thạo 2 tay, nhưng con theo kịp các yêu cầu của thầy"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 7,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím khá tốt, biết dùng thêm các phím tắt cho nhanh hơn, con đã đạt yêu cầu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 8,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím tốt, con đã biết gõ phím 2 tay, ở tốc độ vừa phải, tận dụng tốt các phần mềm máy tính,"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 9,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím thành thạo, con sử dụng gõ phím bằng 2 tay, tương đối thành thạo cài đặt và dùng các phần mềm máy tính"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 10,
                            "commentSamples": [
                                "Tốc độ sử dụng chuột/bàn phím rất thành thạo, có thể sử dụng gõ phím bằng 2 tay không cần nhìn phím, con biết tận dụng tối ưu các phần mềm máy tính"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022399",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936397273",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 5,
                    "slots": [
                        "1",
                        "final",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c477496ae1a9fab6320cab",
                    "name": "[ART] Kỹ năng sáng tạo",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Kỹ năng sáng tạo",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024KỹNangSangTạo",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Học viên chưa thể tái hiện các mẫu tác phẩm mỹ thuật số, chưa phát huy khả năng tưởng tượng và sáng tạo ý tưởng trong qua trình học"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Học viên có thể tái hiện được các đặc điểm sự vật sự việc từ đời thật thành tác phẩm của mình dựa trên hướng dẫn của giáo viên"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Học viên phát huy khả năng tưởng tượng, sáng tạo ra các sản phẩm mang tính thẩm mỹ mang màu sắc riêng của bản thân."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Học viên có thể mô tả được các bước thao tác, ứng dụng các quy trình sáng tạo/ thiết kế đã học để tạo ra các sản phẩm sáng tạo"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Học viên xây dựng và hoàn thiện tác phẩm của cá nhân, tạo ra các sản phẩm mang tính sáng tạo màu sắc, cá tính riêng"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724151625151",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206559887",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 5,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c476ea6ae1a9fab6320a4e",
                    "name": "[ART] Tư duy thẩm mỹ",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Tư duy thẩm mỹ",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024TưDuyThẩmMỹ",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Học viên chưa thể nhận biết và phân biệt được các yếu tố mỹ thuật cơ bả"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Học viên có thể phân biệt và vận dụng được một cách cơ bản các yếu tố mỹ thuật đã được học để tạo sản phẩm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Học viên có thể mô tả và phân tích được các yếu tố mỹ thuật, từ đó tạo nên các hiệu ứng thẩm mỹ để hoàn thiện sản phẩm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Học viên ứng dụng nâng cao các kiến thức thẩm mỹ và có thể truyền đạt được thông tin qua các tác phẩm của mình"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Học viên có thể đưa ra đánh giá, nhận xét các tác phẩm của cá nhân, của bạn bè dựa trên những tiêu chuẩn thẩm mỹ"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724151530843",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206569803",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 4,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c5672c6ae1a9fab6337d81",
                    "name": "[RBT] Kỹ năng giải quyết vấn đề",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[RBT] Kỹ năng giải quyết vấn đề",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "rbtKỹNangGiảiQuyếtVấnDề",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "- Học viên chưa nhận biết được các vấn đề và chưa biết cách phân tích vấn đề để có ý tưởng giải quyết"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Học viên nhận biết, phân tích và trình bày được sự ảnh hưởng của vấn đề và đưa ra một số giải pháp nhưng chưa đủ tính ứng dụng, thuyết phục \n- Học viên có thể hiện sự kiên nhẫn khi đối mặt với thất bại trong quá trình kiếm thử nhưng còn hạn chế trong việc tìm ra giải pháp"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "- Học viên biết cách chia vấn đề lớn thành các vấn đề nhỏ hơn và lần lượt giải quyết\n- Học viên tìm ra được giải pháp cải thiện qua việc thử nghiệm liên tục và dần hoàn thiện sản phẩm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Phân tích vấn đề tốt, bắt đầu tự đưa ra giải pháp của riêng mình,\n- Học viên hướng ý tưởng sản phẩm về thực tế: sản phẩm có tính năng giải quyết vấn đề thực tế nào"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Học viên phản biện và phân tích các giải pháp một cách chi tiết và thuyết phục, biết thử đi thử lại nhiều lần đến khi ra kết quả từ đó học viên có thể tổng quát cho nhiều vấn đề tương tự sau này."
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724213036944",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": null,
                    "lastModifiedBy": null,
                    "sortOrder": 4,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "9"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c476196ae1a9fab63208bc",
                    "name": "[ART] Kỹ năng sử dụng máy tính, kỹ năng công nghệ",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Kỹ năng sử dụng máy tính, kỹ năng công nghệ",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024KỹNangSửDụngMayTinhKỹNangCongNghệ",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "- Học viên chưa nắm bắt được keyword cần thiết để tìm kiếm hình ảnh, tư liệu thiết kế.\n- Học viên chưa có khả năng sử dụng công cụ, phần mềm để thiết kế"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Học viên nắm bắt được keyword cần thiết để tìm kiếm hình ảnh, tư liệu thiết kế trên các công cụ tìm kiếm phù hợp.\n- Học viên biết tìm kiếm tài liệu tham khảo ở các nguồn mở."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Học viên biết lưu file/ xuất file và truyền dữ liệu từ giữa các công cụ số khác nhau, nhận biết được chính xác nên dùng công cụ nào để làm ra được sản phẩm theo đề bài."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên nắm vững cách sử dụng phần mềm học tập và chủ động tìm tòi, nghiên cứu công cụ trong quá trình học tập.\n- Học viên có ứng dụng công nghệ Trí Tuệ Nhân Tạo (AI) qua việc sử dụng phần mềm để tham khảo ý tưởng, hỗ trợ thiết kế một cách khoa học."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Học viên thành thạo trong việc sử dụng phần mềm, ứng dụng công nghệ để thiết kế và hoàn thiện tác phẩm cá nhân.\n- Học viên có thể mô tả được trải nghiệm/ thực hiện thiết kế và tạo triển lãm tác phẩm mỹ thuật cá nhân với công nghệ triển lãm thực tế ảo"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724151321209",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206584443",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 3,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c566db6ae1a9fab6337c73",
                    "name": "[RBT] Kỹ năng tư duy máy tính, tư duy thuật toán",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[RBT] Kỹ năng tư duy máy tính, tư duy thuật toán",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "rbtKỹNangTưDuyMayTinhTưDuyThuậtToan",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "- Học viên chưa ghi nhớ, chưa nắm được các khái niệm cơ bản về lập trình điều khiển Robot.\n- Học viên chưa thể tự thực hiện lập trình dù chỉ mức cơ bản."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Học viên có thể phân biệt được các thẻ lệnh, lập trình được chương trình đơn giản với sự hỗ trợ từ giáo viên\n- Học viên có thể trả lời các câu hỏi gợi mở của giáo viên để dần hiểu về trình tự tư duy thuật toán và bắt đầu tiếp cận với giao diện lập trình trực quan, công cụ công nghệ để giải quyết vấn đề.\n- Học viên biết tách nhỏ các vấn đề để ứng dụng thuật toán giải quyết, tuy nhiên chưa có đủ năng lực để xử lý"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "- Học viên hiểu về các câu lệnh đơn giản và có thể giải quyết các vấn đề trung bình mà không cần sự hỗ trợ.\n- Học viên tìm ra được logic chung trong quá trình phân tích vấn đề và nhận thấy được tính kế thừa, tần suất lặp lại khi sử dụng câu lệnh\n- Học viên mô tả được thuật toán thành ngôn ngữ code tương ứng."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên có khả năng thay đổi thông số của thẻ lệnh để giải quyết các vấn đề khác nhau\n- Học viên phản xạ nhanh với mô hình và ngôn ngữ code, biết chọn lọc và vận dụng kiến thức thuật toán nào để xử lý vấn đề."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Học viên thành thạo công dụng và thông số của thẻ lệnh, giải quyết mọi vấn đề phức tạp một cách độc lập trong lập trình điểu khiển Robot\n- Học viên có thể tự xây dựng và phát triển mô hình cá nhân của mình mà không cần (cần rất ít) sự hỗ trợ từ Giáo viên"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724212955503",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724212968713",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 3,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "9"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c00060085198",
                    "name": "Kiên trì, không bỏ cuộc",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Kiên trì, không bỏ cuộc",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Kiên trì, không bỏ cuộc",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Kiên trì, không bỏ cuộc",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Khi gặp bất kỳ một đề bài, con ngại bắt tay vào làm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Khi gặp một vấn đề trở ngại, con có xu hướng bỏ cuộc sớm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Khi gặp nhiều vấn đề vướng mắc, con sẽ không muốn tiếp tục nữa"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Khi gặp vấn đề dễ, con dễ dàng xử lý, nhưng các vấn đề khó con bộc lộ sự chán nản không muốn làm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Khi gặp vấn đề khó, con cũng cố 1 lúc nhưng rồi sẽ nhờ thầy giúp đỡ ngay"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 6,
                            "commentSamples": [
                                "Khi gặp vấn đề dễ hay khó, con cố gắng tìm cách giải quyết nhưng không làm đến cùng"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 7,
                            "commentSamples": [
                                "Con cố gắng giải quyết vấn đề dù khó hay dễ, nhưng hay tìm kiếm sự giúp đỡ dù chưa suy nghĩ kỹ"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 8,
                            "commentSamples": [
                                "Con cố gắng suy nghĩ kỹ khi gặp vấn đề, bắt tay vào làm, nếu mãi không làm được thì sẽ tìm kiếm sự giúp đỡ"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 9,
                            "commentSamples": [
                                "Con rất kiên trì, dù khó đến đâu vẫn cố suy nghĩ và tìm kiếm giải pháp, con nhờ thầy gợi ý cách làm để tiếp tục"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 10,
                            "commentSamples": [
                                "Con rất kiên trì, dành nhiều thời gian để tự suy nghĩ và tự học, thay đổi nhiều phương án đến khi hoàn thành xong thì thôi"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022633",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936673455",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 2,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "15",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "final"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c54ccf6ae1a9fab632f23a",
                    "name": "[ART] Kiến thức trên lớp",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[ART] Kiến thức trên lớp",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "art2024KiếnThứcTrenLớp",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Học viên chưa nắm được những kiến thức cơ bản nhất trong các nội dung đã học."
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Học viên hiểu và áp dụng được một số khái niệm cơ bản trong bài học\n- Học viên vẫn cần sự hỗ trợ, hướng dẫn sát sao từ giáo viên"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "- Học viên nắm được hết các kiến thức cơ bản nhưng còn hay quên, mất nhiều thời gian để ghi nhớ và cần ôn tập thêm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên hiểu kiến thức ngay trong buổi học\n- Học viên nắm và áp dụng toàn bộ kiến thức đã học vào thực hành"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Ngoài việc nắm vững các kiến thức được giảng dạy, học viên còn có sự chủ động, đặt câu hỏi mở rộng trực tiếp tại lớp từ những kiến thức vừa được cung cấp"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724206287093",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": "1724206509790",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 2,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c566896ae1a9fab6337a44",
                    "name": "[RBT] Kiến thức học tại lớp",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[RBT] Kiến thức học tại lớp",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "rbtKiếnThứcHọcTạiLớp",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "- Học viên chưa nắm được những kiến thức cơ bản nhất trong các nội dung đã học"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "- Học viên hiểu và áp dụng được một số khái niệm cơ bản trong bài học\n- Học viên vẫn cần sự hỗ trợ, hướng dẫn nhiều từ giáo viên"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "- Học viên nắm được hết các kiến thức cơ bản nhưng còn hay quên, mất nhiều thời gian để ghi nhớ và cần ôn tập lại"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "- Học viên hiểu kiến thức ngay trong buổi học\n- Học viên nắm và áp dụng toàn bộ kiến thức đã học vào thực hành"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "- Ngoài việc nắm vững các kiến thức được giảng dạy, học viên còn có sự chủ động, đặt câu hỏi mở rộng trực tiếp tại lớp từ những kiến thức vừa được cung cấp"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724212873673",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": null,
                    "lastModifiedBy": null,
                    "sortOrder": 2,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "7",
                        "9",
                        "6"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "66c5661f6ae1a9fab63378de",
                    "name": "[RBT] Các nội dung đã học",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[RBT] Các nội dung đã học",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "rbtCacNộiDungDaHọc",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1724212767538",
                    "createdBy": "669e207ecdd898001c3185d1",
                    "lastModifiedAt": null,
                    "lastModifiedBy": null,
                    "sortOrder": 1,
                    "slots": [
                        "1",
                        "10",
                        "11",
                        "12",
                        "13",
                        "2",
                        "3",
                        "5",
                        "6",
                        "7",
                        "9"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c000600851a3",
                    "name": "Cẩn thận, chỉn chu",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Cẩn thận, chỉn chu",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Cẩn thận, chỉn chu",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Cẩn thận, chỉn chu",
                    "type": "RATE",
                    "rates": [
                        {
                            "value": 1,
                            "commentSamples": [
                                "Con làm các công việc rất ẩu, không có sự rà soát lại cách làm"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 2,
                            "commentSamples": [
                                "Con thực hiện yêu cầu vội vàng, rà soát bài làm không kỹ"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 3,
                            "commentSamples": [
                                "Con có kiểm tra lại cách làm nhưng không cẩn thận, có nhiều lỗi hiển nhiên"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 4,
                            "commentSamples": [
                                "Con dành thời gian suy nghĩ trước khi làm, nhưng chưa kỹ, làm còn nhiều lỗi"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 5,
                            "commentSamples": [
                                "Con có suy nghĩ tương đối trước khi bắt tay làm, code có để ý những nguyên tắc cơ bản, nhưng bài làm vẫn còn lộn xộn, chưa gọn gàng"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 6,
                            "commentSamples": [
                                "Con code tuân thủ theo những nguyên tắc cơ bản, bài làm có chỗ vẫn lộn xộn, tuỳ ý"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 7,
                            "commentSamples": [
                                "Con code có trật tự, nhưng làm xong không rà soát kỹ, làm vẫn vội"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 8,
                            "commentSamples": [
                                "Code của con khá gọn gàng, được kiểm tra lại kỹ, nhưng một số chi tiết vẫn còn chưa ch\bỉn chu"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 9,
                            "commentSamples": [
                                "Code của con theo các nguyên tắc chuẩn, bài làm chỉn chu, người khác dễ đọc, dễ hiểu và phối hợp"
                            ],
                            "__typename": "Rate"
                        },
                        {
                            "value": 10,
                            "commentSamples": [
                                "Code của con chuẩn, cấu trúc dễ phối hợp, con có thói quen chỉn chu kiểm tra kỹ càng và sửa từng chi tiết"
                            ],
                            "__typename": "Rate"
                        }
                    ],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022658",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936422728",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 1,
                    "slots": [
                        "1",
                        "final",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "61690eced815c000600851ae",
                    "name": "Một số minh chứng về việc học của con trong lớp",
                    "translations": [
                        {
                            "key": "name",
                            "value": "Một số minh chứng về việc học của con trong lớp",
                            "locale": "vi",
                            "__typename": "Translation"
                        },
                        {
                            "key": "name",
                            "value": "Một số minh chứng về việc học của con trong lớp",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "Một số minh chứng về việc học của con trong lớp",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1634275022705",
                    "createdBy": "5e5500d76ee74231d394aebe",
                    "lastModifiedAt": "1727936588555",
                    "lastModifiedBy": "669e207ecdd898001c3185d1",
                    "sortOrder": 0,
                    "slots": [
                        "final",
                        "1",
                        "2",
                        "3",
                        "4",
                        "6",
                        "7",
                        "8",
                        "10",
                        "11",
                        "12",
                        "13",
                        "14",
                        "15"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "686dd6b39f378169d16f102c",
                    "name": "[Cregen] File Sản phẩm mỗi buổi",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[Cregen] File Sản phẩm mỗi buổi",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "fileSảnPhẩmMỗiBuổi",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1752028851025",
                    "createdBy": "67dcebbd246a95001c33f90f",
                    "lastModifiedAt": "1752031364721",
                    "lastModifiedBy": "67dcebbd246a95001c33f90f",
                    "sortOrder": null,
                    "slots": [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "686dd8b7c0ec0c2cb2125158",
                    "name": "[Cregen] Tiến độ Sản phẩm mỗi buổi",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[Cregen] Tiến độ Sản phẩm mỗi buổi",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "artTiếnDộSảnPhẩmMỗiBuổi",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1752029367359",
                    "createdBy": "67dcebbd246a95001c33f90f",
                    "lastModifiedAt": "1752030585283",
                    "lastModifiedBy": "67dcebbd246a95001c33f90f",
                    "sortOrder": null,
                    "slots": [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                },
                {
                    "id": "686dda6ec0ec0c2cb2125568",
                    "name": "[Cregen] Kiến thức được học mỗi buổi",
                    "translations": [
                        {
                            "key": "name",
                            "value": "[Cregen] Kiến thức được học mỗi buổi",
                            "locale": "en",
                            "__typename": "Translation"
                        }
                    ],
                    "fieldName": "kiếnThứcDượcHọcMỗiBuổiArt",
                    "type": "CONTENT",
                    "rates": [],
                    "checkpoint": null,
                    "isActive": true,
                    "createdAt": "1752029806691",
                    "createdBy": "67dcebbd246a95001c33f90f",
                    "lastModifiedAt": "1752030542391",
                    "lastModifiedBy": "67dcebbd246a95001c33f90f",
                    "sortOrder": null,
                    "slots": [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7"
                    ],
                    "isPublic": false,
                    "isRequired": false,
                    "guideline": null,
                    "__typename": "CommentArea"
                }
            ],
            "pagination": {
                "total": 20,
                "__typename": "FindCommentAreasPagination"
            },
            "__typename": "FindCommentAreasResponse"
        }
    }
}
```