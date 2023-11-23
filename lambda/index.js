// export const handler = async (event, context) => {
  
//     const length = event.length;
//     const width = event.width;
//     var area = calculateArea(length, width);
//     console.log(`The area is ${area}`);
          
//     console.log('CloudWatch log group: ', context.logGroupName);
    
//     const data = {
//       "area": area,
//     };
//       return JSON.stringify(data);
      
//     function calculateArea(length, width) {
//       return length * width;
//     }
//   };

export const handler = async (event, context) => {
    console.log('Received Message:', JSON.stringify(event));
callback(null, "Hello, World!")


}