// 외부모듈 포함
const express = require('express');
const app = express();
//var bodyParser = require('body-parser');

const { FileSystemWallet, Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

const fs = require('fs');
const path = require('path');

// 서버설정
const PORT = 3000;
const HOST = '0.0.0.0';
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// fabric 연결설정
const ccpPath = path.resolve(__dirname, 'connection-org1.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// index.html 페이지 라우팅
app.get('/', (req, res)=>{
    res.sendFile(__dirname + '/index.html');
});

// REST 라우팅
// /career POST 이력 등록
app.post('/career', async(req, res)=>{

    try{
    
        const userId = req.body.userId;
        const projectId = req.body.projectId;
        const projectName = req.body.projectName;
        const period = req.body.period;
        const company = req.body.company;
        const position = req.body.position;
        const role = req.body.role;
    
        console.log('/career-post-'+userId+'-'+projectId+'-'+projectName+'-'+period+'-'+company+'-'+position+'-'+role)
        
        // 인증서 확인
        const walletPath = path.join(process.cwd(), 'wallet');
        
        const wallet = await Wallets.newFileSystemWallet(walletPath);
    
        console.log(`Wallet path: ${walletPath}`);
    
        const identity = await wallet.get(userId);
    
        if(!identity) {
            console.log('An identity for the user appUser does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
    
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the user does not exist in the wallet"}');
            res.send(result_obj);
            return;
        }
    
        // GW -> CH -> CC
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: true, asLocalhost: true } });
    
        const network = await gateway.getNetwork('busanchannel');
        const contract = network.getContract('career');
    
        await contract.submitTransaction('CreateCareer', projectId, projectName, period, company, position, role);
        console.log('Transaction has been submitted');
        await gateway.disconnect();
    
        // submit Transaction -> (TO DO) JSON 형태로 보내주기
        const result_obj = JSON.parse('{"result":"success", "message":"Transaction has been submitted."}');
        res.send(result_obj);

    }catch(error){
        console.log('error occured in generating in submitting a transaction.');
        const result_obj = JSON.parse('{"result":"fail", "error":"error occured in submitting a transaction."}');
        res.send(result_obj);
    }    
});

// /career GET 이력 확인
app.get('/career', async(req, res)=>{

    try{
        const userId = req.body.userId;
        const projectId = req.body.projectId;
            
        console.log('/career-get-'+userId+'-'+projectId);
        
        // 인증서 확인
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
        const identity = await wallet.get(userId);
    
        if(!identity) {
            console.log('An identity for the user appUser does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
    
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the user does not exist in the wallet"}');
            res.send(result_obj);
            return;
        }
    
        // GW -> CH -> CC
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: true, asLocalhost: true } });
    
        const network = await gateway.getNetwork('busanchannel');
        const contract = network.getContract('career');
    
        const result = await contract.evaluateTransaction('QueryCareer', projectId);
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);
        await gateway.disconnect();
    
        // submit Transaction -> (TO DO) JSON 형태로 보내주기
        const result_obj = JSON.parse(`{"result":"success", "message":${result}}`);
        res.send(result_obj);

    }catch(error){
        // client에게 결과 전송 - 실패
        console.log('error occured in generating in submitting a transaction.');
        const result_obj = JSON.parse('{"result":"fail", "error":"error occured in evaluating a transaction."}');
        res.send(result_obj);
    }


});

// /car/tx POST 소유권 이전 ROUTING
app.post('/car/tx', async(req, res) => {

    try{
        // client로 파라미터 받기
        const cert = req.body.cert;
        const carid = req.body.carid;
        const newowner = req.body.newowner;

        console.log('/car/tx-post-'+cert+'-'+carid+'-'+newowner)

        // 인증서 확인 -> 전달받은 인증서 사용
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
        const identity = await wallet.get(cert);

        if(!identity) {
            console.log(`An identity for the ${cert} appUser does not exist in the wallet`);
            console.log('Run the registerUser.js application before retrying');

            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the user does not exist in the wallet"');
            res.send(result_obj);
            return;
        }

        // gw -> ch -> cc
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: cert, discovery: { enabled: true, asLocalhost: true } });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabcar');

        await contract.submitTransaction('changeCarOwner', carid, newowner);
        console.log('Transaction has been submitted');
        await gateway.disconnect();

        const result_obj = JSON.parse('{"result":"success", "message":"Transaction has been submitted"}');
        res.send(result_obj)

    }catch(error){
        console.log('fail');
        const result_obj = JSON.parse('{"result":"fail", "error":"fail"}');
        res.send(result_obj)
    }

});


// /car/history GET 차량정보 이력 라우팅
app.get('/car/history', async(req, res)=> {
    try{
        const cert = req.query.cert;
        const carid = req.query.carid;

        console.log('/car/history-get-' + cert + '-' + carid);

        // 인증서 확인 -> (TO DO) 전달받은 인증서 사용하기
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
        const identity = await wallet.get(cert);

        if (!identity) {
            console.log(`An identity for the user ${cert} does not exist in the wallet`);
            console.log('Run the registerUser.js application before retrying');
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the user does not exist in the wallet"}');
            res.send(result_obj);
            return;
        }

        // GW -> CH -> CC
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: cert, discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabcar');

        const result = await contract.evaluateTransaction('GetHistory', carid);
        console.log('Transaction has been evaluted');
        await gateway.disconnect();

        const result_obj = JSON.parse(`{"result":"success", "message":${result}}`);
        res.send(result_obj);

    }catch(error){
        console.log('error occured in generating in submitting a transaction.');
        const result_obj = JSON.parse('{"result":"fail", "error":"error occured in evaluating a transaction."}');
        res.send(result_obj);
    }
});

// /admin POST
app.post('/admin', async(req, res) => {
    // clinet로부터 params 받아오기
    const aid = req.body.id;
    const apw = req.body.pw;

    console.log('/admin-id-'+aid+'-'+apw);

    try{
        // ccp 객체 구성
        const ccpPath = path.resolve(__dirname, 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // ca 객체 생성과 연결
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false}, caInfo.caName);

        // 지갑객체 생성과 기등록 admi 인증서 확인
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`wallet path : ${walletPath}`);

        // 기등록 admin 존재 -> client에 결과 전송 -> 실패
        const identity = await wallet.get(aid);
        if(identity){
            console.log('An identity for the admin user admin already exists in the wallet');
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the admin user admin already exists in the wallet"}');
            res.send(result_obj);
            return;
        }

        // ca에 관리자 인증서 등록
        const enrollment = await ca.enroll({ enrollmentID: aid, enrollmentSecret: apw });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        // 관리자 인증서 저장
        await wallet.put(aid, x509Identity);
        console.log('Successfully enrolled admin user admin and imported it into the wallet');

        // client에게 결과 전송 - 성공
        const result_obj = JSON.parse('{"result":"success", "message":"Successfully enrolled admin user admin and imported it into the wallet"}');
        res.send(result_obj);

    }catch(error) {
        // console.log(error);
        // client에게 결과 전송 - 실패
        console.log('error occured in generating a certificate');
        const result_obj = JSON.parse('{"result":"fail", "error":"error occured in generating a certificate"}');
        res.send(result_obj)
    }
});

// /user POST
app.post('/user', async(req, res)=>{
    
    const uid = req.body.uid;
    const urole = req.body.role;
    const udepart= req.body.depart;
    console.log('/user-id-'+uid+'-'+urole+'-'+udepart);
    try{
        
        const ccpPath = path.resolve(__dirname, 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);
        
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
        
        const userIdentity = await wallet.get(uid); // userid
        if (userIdentity) {
            console.log('An identity for the user '+uid+' already exists in the wallet');
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the user already exists in the wallet"}');
            res.send(result_obj);
            return;
        }
       
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            const result_obj = JSON.parse('{"result":"fail", "error":"An identity for the admin does not exist in the wallet"}');
            res.send(result_obj);
            return;
        }
        

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        const secret = await ca.register({
            affiliation: udepart, // 'org1.department1'
            enrollmentID: uid,
            role: urole// 'client'
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: uid,
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put(uid, x509Identity);
        console.log('Successfully registered and enrolled admin user '+uid+' and imported it into the wallet');

        // client에게 결과 전송 - 성공
        const result_obj = JSON.parse('{"result":"success", "message":"successfully enrolled and imported it into the wallet"}');
        res.send(result_obj);

    } catch(error) {

        console.log(error)

        // client에게 결과 전송 - 실패
        console.log('error occured in generating a certificate.');
        const result_obj = JSON.parse('{"result":"fail", "error":"error occured in generating a certificate."}');
        res.send(result_obj);
    }
});

// 서버시작
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);