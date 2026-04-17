$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open('c:\Users\ADMIN\hireon-ai\Offer letter of Dhrumi Thakkar.docx')
$content = $doc.Content.Text
$content | Out-File -FilePath 'c:\Users\ADMIN\hireon-ai\offer_template_plain.txt' -Encoding utf8
$doc.Close()
$word.Quit()
