function valiatoreCreator(schema){
    return function validator(req, res, next){
        console.log("Req.body " , req.body)
        let { error , value } = schema.validate(req.body);
        console.log("Validating body");
        if(error){
            console.log("Error happened while schema validation");
            return res.status(400).json({message: error.details[0].message});
        }
        console.log("Value is " , value );
        req.validatedBody = value;
        console.log("req.validatedBody is " , req.validatedBody);
        next();
    }
}

function validatorForParams(schema){
    return function validator(req, res, next){
        // console.log("Validating params with schema ", req.params , schema.describe());
        let { error , value } = schema.validate(req.query);
        if(error){
            console.log("Error in validating params ", error.details);
            return res.status(400).json({message: error.details[0].message});
        }   
        req.validatedParams = value;
        console.log("req.validatedParams" , req.validatedParams)  
        next();
    }
}


module.exports = { valiatoreCreator , validatorForParams };