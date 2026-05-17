param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath,
  [string]$PrinterName = 'Canon SELPHY CP1500'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::new($ImagePath)
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $PrinterName

if (-not $pd.PrinterSettings.IsValid) {
  throw "Printer not found or offline: $PrinterName"
}

$postcard = $pd.PrinterSettings.PaperSizes |
  Where-Object { $_.PaperName -eq 'Japanese Postcard' } |
  Select-Object -First 1

if ($postcard) {
  $pd.DefaultPageSettings.PaperSize = $postcard
} else {
  $pd.DefaultPageSettings.PaperSize = [System.Drawing.Printing.PaperSize]::new('Custom', 394, 583)
}

$pd.DefaultPageSettings.Landscape = $false
$pd.add_PrintPage({
  param($sender, $e)
  $e.Graphics.DrawImage($img, $e.PageBounds)
})
$pd.Print()
$img.Dispose()

Write-Output "OK: sent to $PrinterName ($($pd.DefaultPageSettings.PaperSize.PaperName))"
