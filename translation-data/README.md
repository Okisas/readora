# Translation data

Thư mục này chứa glossary và dữ liệu translation memory để cải thiện bản dịch về sau.

Định dạng mỗi dòng:

```text
từ/cụm nguồn=giá trị muốn giữ hoặc bản dịch chuẩn
```

Quy ước:

- Một file cho một cặp ngôn ngữ, ví dụ `ja-vi.txt`.
- Dòng bắt đầu bằng `#` là ghi chú.
- Không ghi dữ liệu nhạy cảm hoặc nguyên chương truyện vào đây.
- Tên riêng nên ghi phiên âm/giá trị chuẩn, không nhất thiết dịch nghĩa.

Đây là glossary/translation memory, chưa phải file fine-tune trực tiếp cho LibreTranslate.
