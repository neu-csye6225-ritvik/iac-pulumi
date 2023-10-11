const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

const createSubnets = (vpc, type, count) => {
    let subnets = [];
    for (let i = 0; i < count; i++) {
        let subnet = new aws.ec2.Subnet(`subnet-${type}-${i}`, {
            vpcId: vpc.id,
            cidrBlock: `10.0.${i+1}.0/24`, // CIDR block is provided as example, adjust as per your IP design
            availabilityZone: `us-east-1${String.fromCharCode(97+i)}`, // Make sure to replace it with your desired AWS region
            tags: {
                Name: `subnet-${type}-${i}`,
                Type: type
            }
        });
        subnets.push(subnet);
    }
    return subnets;
}

const main = async() => {
    // Create a VPC
    const vpc = new aws.ec2.Vpc("my-vpc", { cidrBlock: "10.0.0.0/16" });

    // Create public subnets
    const publicSubnets = createSubnets(vpc, 'public', 3);

    // Create private subnets
    const privateSubnets = createSubnets(vpc, 'private', 3);

    // Create an internet gateway and attach it to the VPC
    const internetGateway = new aws.ec2.InternetGateway("igw", {});

    const vpcGatewayAttachment = new aws.ec2.VpcInternetGatewayAttachment("vpcGatewayAttachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id
    });

    // Create public and private route tables
    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
        vpcId: vpc.id,
    });

    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
        vpcId: vpc.id,
    });

    // Associate the route tables with the corresponding subnets
    for(let i = 0; i < 3; i++) {
        new aws.ec2.RouteTableAssociation(`public-association-${i}`, {
            subnetId: publicSubnets[i].id,
            routeTableId: publicRouteTable.id,
        });

        new aws.ec2.RouteTableAssociation(`private-association-${i}`, {
            subnetId: privateSubnets[i].id,
            routeTableId: privateRouteTable.id,
        });
    }
    console.log( vpc.id)
    return { vpcId: vpc.id, publicSubnets, privateSubnets, internetGatewayId: internetGateway.id };
}

exports = main();

// const aws = require("@pulumi/aws");
// const pulumi = require("@pulumi/pulumi");

// const createSubnets = (vpc, type, count) => {
//     let subnets = [];
//     for (let i = 0; i < count; i++) {
//         let subnet = new aws.ec2.Subnet(`subnet-${type}-${i}`, {
//             vpcId: vpc.id,
//             cidrBlock: `10.0.${i+1}.0/24`, // CIDR block is provided as example, adjust as per your IP design
//             availabilityZone: `us-east-1${String.fromCharCode(97+i)}`, // Make sure to replace it with your desired AWS region
//             tags: {
//                 Name: `subnet-${type}-${i}`,
//                 Type: type
//             }
//         });
//         subnets.push(subnet);
//     }
//     return subnets;
// }

// const main = async() => {
//     // Create a VPC
//     const vpc = new aws.ec2.Vpc("my-vpc", { cidrBlock: "10.0.0.0/16" });

//     // Create public subnets
//     const publicSubnets = createSubnets(vpc, 'public', 3);

//     // Create private subnets
//     const privateSubnets = createSubnets(vpc, 'private', 3);

//     return { vpcId: vpc.id, publicSubnets, privateSubnets };
// }

// exports = main();
