User chọn vùng ảnh
        |
        v
scanSelection()
        |
        v
runOCR()
        |
        v
recognizeOriginalRegion()
        |
        |
        +----------------+
        |                |
        v                v
  Chuẩn hóa ảnh      Tạo biến thể ảnh
                      |
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
     Original    Grayscale    Preprocessed
        |             |             |
        +-------------+-------------+
                      |~
                      v
              Chạy nhiều OCR attempt
                      |
       +--------------+--------------+
       |              |              |
       v              v              v
   OCR lần 1      OCR lần 2      OCR lần 3
       |              |              |
       +--------------+--------------+
                      |
                      v
              Làm sạch kết quả OCR
                      |
                      v
             Chấm điểm từng kết quả
                      |
                      v
          Chọn kết quả có score cao nhất
                      |
                      v
                 Dịch text
                      |
                      v
              Render lên Canvas