
let mongodb = require('mongodb');
let express = require('express');
 let helperFns = require('./helpers/checkRecordAlreadyPresent')
let app = express();

let mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
//const dbUrl = 'mongodb://127.0.0.1:27017';
require('dotenv').config();

//Mongo Atlas data
// username: demoDb Password: mlIF17UGQHxvFJJ1 
const dbUrl =  process.env.DB_URL;
const port = process.env.PORT || 4001;

let st = "";
let students = [{ "student_id": "1", "name": "Balaji", "mentor_id": "100" }, { "student_id": "2", "name": "Ganesh", "mentor_id": "101" }];
let mentors = [{ "mentor_id": "100", "name": "Venkat", "student_ids": ["1"] }, { "mentor_id": "101", "name": "Ashik", "student_ids": ["2"] }];
app.get('/students', async (req, res) => {
    
    try {
        
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db("student_mentor_db");
    let data = await db.collection("students").find().toArray(); 
    res.status(200).json({ "Success": data });
        
    }
    
    catch (error)
    {
        console.error(error);
    }
    
    clientInfo.close();
});

app.get('/mentors', async (req, res) => {
    
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db("student_mentor_db");
    let data = await db.collection("mentors").find().toArray();

    if (data.length > 0)
        res.status(200).json({ "Success": data });
    
    else
        res.status(404).json({ "Error": "Data could not be retrieved!" });
    
    clientInfo.close();
});

app.get('/mentors/:id', async (req, res) => {
    let found = 0;

    try
    {
        
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db("student_mentor_db");
        let mentors = await db.collection("mentors").find().toArray();
        let students = await db.collection("students").find().toArray();
        

    for (let i = 0; i < mentors.length; i++)
        if (mentors[i].mentor_id === req.params.id)
        {
            found = 1;   
            let search_results_students = [];
            for (let j = 0; j < students.length; j++)
            {
                if (mentors[i].student_ids.includes(students[j].student_id))
                search_results_students.push(students[j]);
            }
            
            
            res.status(200).json({ "Students": search_results_students });
            
        }
    
        if (found === 0)
        res.status(404).json({ "Error": "No such Mentor found!" });
        
        clientInfo.close();
    }
    
    catch (error)
    {
        console.error(error);
    }
    
       
})

app.use(express.json());

app.post('/create-student', async (req, res)=> {
    
    let student = req.body;
    let clientInfo = await mongoClient.connect(dbUrl);

    if (student.mentor_id !== "")
        res.status(400).json({ "Error": "Cannot assign Mentor in /create-student endpoint. Use /edit-student only" })

    else
    {
       
    try {

    let db = clientInfo.db("student_mentor_db");
    let students = await db.collection("students").find().toArray();

    let checkStudentAlreadyPresent = helperFns.checkStudentAlreadyPresent;
    let studentAlreadyPresent = checkStudentAlreadyPresent(student.student_id, students);
    

    if (studentAlreadyPresent)
        res.status(409).json({"Error": "Student already present.Try again with unique information"})
    
    else
    {
       
       await db.collection("students").insertOne(student);  
        res.status(200).json({ "Success":"Student created"});
    }
        
    }

    catch(error)
    {
        console.log(error);
    }
    }

    
   
    clientInfo.close();
});

app.post('/create-mentor', async (req, res)=> {
    
    let mentor = req.body;
    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db("student_mentor_db");
    let mentors = await db.collection("mentors").find().toArray();
   
    let checkMentorAlreadyPresent = helperFns.checkMentorAlreadyPresent;
    let mentorAlreadyPresent = checkMentorAlreadyPresent(mentor.mentor_id,mentors);

    //Checking if the mentor is assigned students.If so,
    //warn user to assign stduents only in "update-mentor" API
    if (mentor.student_ids.length !== 0) {
        res.status(400).json({ "Error": "Pls.assign students to mentors only in update-mentor API" })
       
    }

    else if (mentorAlreadyPresent)
        res.status(409).json({ "Error": "Mentor already present.Try again with unique information" });
    else {
        await db.collection("mentors").insertOne(mentor);
        res.status(200).json({"Mentor created": mentor});
       
    }

    clientInfo.close();
});

//Assigning student(s) under a particular mentor
app.put('/edit-mentor/:id', async (req, res) => {

    let clientInfo = await mongoClient.connect(dbUrl);
    try
    {
        
    let db = clientInfo.db("student_mentor_db");
    let students = await db.collection("students").find().toArray();
    let mentors = await db.collection("mentors").find().toArray();
   
   
    let helperFns = require('./helpers/getUnassignedStudents');
    let getUnassignedStudents = helperFns.getUnassignedStudents;
    let unassignedStudents = getUnassignedStudents(students);
    console.log("Unassigned students", unassignedStudents);
    
    let found = 0;
    let wrongInputData = 0;
    
    //Searching for mentor, if found, found=1
    for (let i = 0; i < mentors.length; i++)
    {   
        if (mentors[i].mentor_id === req.params.id)
        {
            found = 1;

            console.log(req.body.students, req.body.students[1]);

            for (let p = 0; p < req.body.students.length; p++)
            {
                if (!unassignedStudents.includes(req.body.students[p]))
                {
                    res.status(404).json({ "Error": "You have tried to reassign assigned students (OR) Have entered students details which are not in the database" });
                    wrongInputData = 1;
                    break;
                }
            }
            if (wrongInputData === 0)
            {
                //Updating selected mentor with assigned students

                await db.collection("mentors").updateOne({_id:objectId(mentors[i]._id)},{
                $push: {
                student_ids: {
                  $each:[...req.body.students ]
                }
                }
                })
                
                //Updating assigned students records
                for (let k = 0; k < students.length; k++)
                {
                    if (req.body.students.includes(students[k].student_id)) {
                        
                        await db.collection("students").findOneAndUpdate({ _id: objectId(students[k]._id) }, {$set: { mentor_id: mentors[i].mentor_id }})
                        //students[k].mentor_id = mentors[i].mentor_id;
                    } 
                }

                
                let updatedMentor = await db.collection("mentors").findOne({ _id: objectId(mentors[i]._id) })
                console.log(updatedMentor);
                res.status(200).json({ "Mentor Updated": updatedMentor });
            }
            
        }

      
    }

     if(found===0)
            res.status(400).json({ "Error": "No such mentor available" });
       
    
    }

    catch (error)
    {
        console.log(error);
    }
    clientInfo.close();
    
})

//Assigning mentor for a particular student
app.put('/edit-student/:id', async (req, res) => {
    let found = 0;

    let clientInfo = await mongoClient.connect(dbUrl);
    let db = clientInfo.db("student_mentor_db");
    let student = await db.collection("students").findOne({ student_id: req.params.id });
    let mentorToBeAssigned = await db.collection("mentors").findOne({ mentor_id: req.body.mentor });

    if (student === null)
        res.status(404).json({ "Error": "No such student found in database" })

    else if (mentorToBeAssigned === null)
        res.status(404).json({ "Error": "No such mentor found in database" })
    
    else
    {
        console.log("Mentor found", mentorToBeAssigned);
        
        //Update old mentor records &remove the current student from his students list
        await db.collection("mentors").findOneAndUpdate({ mentor_id: student.mentor_id }, { $pull: { student_ids: student.student_id } });

        //Add new mentor id to current student
        await db.collection("students").findOneAndUpdate({ _id: objectId(student._id) }, { $set: { mentor_id: mentorToBeAssigned.mentor_id } });

        //Update new mentor record with current student's details
        await db.collection("mentors").findOneAndUpdate({ mentor_id: req.body.mentor }, { $push: { student_ids: req.params.id } });
        
        let updatedStudent = await db.collection("students").findOne({ student_id: req.params.id });
        res.status(200).json({ "Mentor assigned successfully": updatedStudent });

        
    } 

   
    
})

//Deleting a student
app.delete('/delete-student/:id', async (req, res) => {  
    let clientInfo = await mongoClient.connect(dbUrl); 
    try {
        
    
    let db = clientInfo.db("student_mentor_db");
         let student = await db.collection("students").findOne({ student_id: req.params.id });
         //let mentors = await db.collection("mentors").find().toArray();
         if(student===null)
         res.status(404).json({"Error":"No such student in the records"});

         else
         {
             console.log(student," is retrieved");
         let asso_mentor_id = student.mentor_id;

         await db.collection("mentors").updateOne({ mentor_id: asso_mentor_id }, {
            
            $pull: {student_ids: student.student_id}
         });

         //let asso_mentor = await db.collections("mentors").find({ mentor_id: asso_mentor_id });
         await db.collection("students").deleteOne({ _id: objectId(student._id) })

         //console.log("Updated mentor", asso_mentor);
         res.status(200).json({"Student deleted":student});
        
         
         }
         
         clientInfo.close();
        }
    
    catch (error)
    {
         console.error(error);
         res.status(404).json({ "Error": error });
    }
    
     
})

//Deleting a Mentor
app.delete('/delete-mentor/:id', async (req, res) => {
  
     let clientInfo = await mongoClient.connect(dbUrl);
    try
    {

       
        let db = clientInfo.db("student_mentor_db");
        let mentor_to_be_deleted = await db.collection("mentors").findOne({ mentor_id: req.params.id });
        if (mentor_to_be_deleted === null)
            res.status(404).json({ "Error": "No such mentor found in database" });
        
        else
        {
            //1. Get all student records of the current mentor  && 
            //2. Remove the mentor id from each student record

            await db.collection("students").updateMany({student_id:{$in: mentor_to_be_deleted.student_ids}}, { $set: { mentor_id: "" } })
            
            //3. Delete the current mentor
            await db.collection("mentors").deleteOne({ _id: objectId(mentor_to_be_deleted._id) });

            res.status(200).json({ "Mentor Deleted Successfully": mentor_to_be_deleted });
        }
        
    }

    catch (error)
    {
        console.log("error");
    }
    
    clientInfo.close();
    
})
app.listen(port,()=>{console.log("App runs with ",port)});
