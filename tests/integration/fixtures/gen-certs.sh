#!/bin/sh
set -eu

out="$1"
mkdir -p "$out"
cd "$out"

cat > ca.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no
[dn]
CN = aad-test-ca
[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
EOF

new_ca() {
	openssl req -x509 -config ca.cnf -extensions v3_ca -newkey rsa:2048 -noenc -days 2 \
		-subj "/CN=$1" -keyout "$2.key" -out "$2.pem"
}

sign() {
	openssl req -new -newkey rsa:2048 -noenc -subj "/CN=$1" -keyout "$2.key" -out "$2.csr"
	openssl x509 -req -in "$2.csr" -CA ca.pem -CAkey ca.key -CAcreateserial -days 2 -extfile "$2.ext" -out "$2.pem"
}

new_ca aad-test-ca ca
new_ca aad-wrong-ca wrong-ca

printf 'subjectAltName=DNS:postgres-tls\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' > server.ext
sign postgres-tls server

printf 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=clientAuth\n' > client.ext
sign authelia_mtls client

rm -f ./*.csr ./*.ext ./*.srl ca.cnf
chmod 644 ./*
echo "certificates ready"
