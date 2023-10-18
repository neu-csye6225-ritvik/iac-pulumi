const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
// const config = require("./config");


const fs = require('fs');
const yaml = require('js-yaml');

let stackName = pulumi.getStack();
let configFileName = `Pulumi.${stackName}.yaml`;


const config = yaml.load(fs.readFileSync(configFileName, 'utf8'));


let id = 0;


const createSubnets = (vpc, type, count) => {
    let subnets = [];
    let flag = false;
    if (type === "public") {
        flag = true
    }

    const octets = config.subnetCIDR.split('.');

    for (let i = 0; i < count; i++) {
        let subnet = new aws.ec2.Subnet(`subnet-${type}-${i}`, {
            vpcId: vpc.id,
            cidrBlock: `${octets[0]}.${octets[1]}.${id++}.${octets[3]}/${config.subnetMask}`,
            availabilityZone: `${config.availabilityZone}${String.fromCharCode(97 + i)}`,
            // mapPublicIpOnLaunch: flag,
            tags: {
                Name: `subnet-${type}-${i}`,
                Type: type
            }
        });
        subnets.push(subnet);
    }
    return subnets;
}

const main = async () => {

    // Create a VPC
    const vpc = new aws.ec2.Vpc("my-vpc", {
        cidrBlock: config.baseCIDRBlock,
        tags: {
            Name: config.vpcName,
        },
    });

    // Create public subnets
    const publicSubnets = createSubnets(vpc, 'public', config.numOfPubSubnets);

    // Create private subnets
    const privateSubnets = createSubnets(vpc, 'private', config.numOfPriSubnets);

    // Create an internet gateway and attach it to the VPC
    const internetGateway = new aws.ec2.InternetGateway("igw", {
        tags: {
            Name: config.igName,
        },
    });

    const vpcGatewayAttachment = new aws.ec2.InternetGatewayAttachment("vpcGatewayAttachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id
    });

    // Create public route tables
    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
        vpcId: vpc.id,
        // gatewayId: internetGateway.id
    });

    // Create private route tables
    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
        vpcId: vpc.id,
    });

    //create a public route and setting a cidr destination
    const publicRoute = new aws.ec2.Route("publicRoute", {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.id
    });

    // Associate the public route tables with the public subnets
    for (let i = 0; i < config.numOfPubSubnets; i++) {
        new aws.ec2.RouteTableAssociation(`public-association-${i}`, {
            subnetId: publicSubnets[i].id,
            routeTableId: publicRouteTable.id,
        });
    }

    // Associate the public route tables with the public subnets
    for (let i = 0; i < config.numOfPriSubnets; i++) {
        new aws.ec2.RouteTableAssociation(`private-association-${i}`, {
            subnetId: privateSubnets[i].id,
            routeTableId: privateRouteTable.id,
        });
    }

    // Create an AWS resource (Security Group)
    let sg = new aws.ec2.SecurityGroup("web-secgrp", {
        vpcId: vpc.id,
        description: "Enable HTTP access",
        ingress: [
            { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 7799, toPort: 7799, cidrBlocks: ["0.0.0.0/0"] }
        ],
    });

    // const ami = aws.ec2.getAmi({
    //     mostRecent: true,
    //     filters: [
    //         {
    //             name: 'state',
    //             values: ['available'],
    //         },
    //     ],
    //     owners: ['self'],
    // })

    // console.log(ami.id);

    const ec2Instance = new aws.ec2.Instance("myInstance", {
        // ami: ami.then(img => img.id), // Use the AMI ID from our ami lookup.
        ami: config.ami,
        instanceType: config.instance_type, // This is the instance type. 
        keyName: config.keyPair,
        subnetId: publicSubnets[0].id,
        vpcSecurityGroupIds: [sg.id],
        disableApiTermination: false, // Protect against accidental termination.
        associatePublicIpAddress: true,
        rootBlockDevice: {
            volumeSize: 20, // Root volume size in GB.
            volumeType: "gp2", // Root volume type.
            deleteOnTermination: true, // Delete the root EBS volume on instance termination.
        },
        tags: {
            Name: `debianEC2`,
        },

    });

    return { vpcId: vpc.id, publicSubnets, privateSubnets, internetGatewayId: internetGateway.id, publicRoute, vpcGatewayAttachment, ec2Instance, sg };
}

exports = main();

