import codecs

# Read the file with latin-1 encoding (which interprets the corrupted chars correctly)
with codecs.open('public/index.html', 'r', encoding='latin-1') as f:
    content = f.read()

# Replace corrupted characters with correct Portuguese characters
replacements = {
    'M├írcia': 'Márcia',
    'Tr├ífego': 'Tráfego',
    'Convers├úo': 'Conversão',
    'M├®dio': 'Médio',
    'Qualifica├º├úo': 'Qualificação',
    'Cat├ílogos': 'Catálogos',
    '├Ültimos': 'Últimos',
    'Distribui├º├úo': 'Distribuição',
    'Geogr├ífica': 'Geográfica',
    '­ƒöÑ': '🔥',
    '­ƒƒí': '🟡',
    'ÔØä´©Å': '❄️',
    '­ƒöä': '🔄'
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Write back with UTF-8 encoding
with codecs.open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Encoding fixed successfully!")
