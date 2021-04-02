
let mongodb = require('mongodb');
let express = require('express');
 let helperFns = require('./helpers/checkRecordAlreadyPresent')
let app = express();

let mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const dbUrl = 'mongodb://127.0.0.1:27017';



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
                /*for (let x = 0; x < req.body.students.length; x++)
                mentors[i].student_ids.push(req.body.students[x]);*/

                db.collection("mentors").findOneAndUpdate({_id:objectId(mentors[i]._id)},{
                $push: {
                student_ids: {
                $each: [ req.body.students ]
                }
                }
                })
                
                //Updating assigned students records
                /*for (let k = 0; k < students.length; k++)
                {
                    if (req.body.students.includes(students[k].student_id))
                    students[k].mentor_id = mentors[i].mentor_id;
                }*/

                db.collection("students").findAndModify({
                    query: {},
                    
                    update: {}
                })
                res.status(200).json({ "Mentor Updated": mentors[i] });
            }
            
        }

      
    }

     if(found===0)
            res.status(400).json({ "Error": "No such mentor available" });
       
    
})

//Assigning mentor for a particular student
app.put('/edit-student/:id', (req, res) => {
    let found = 0;
    
    //Searching for student, if found, found=1
    for (let i = 0; i < students.length; i++)
    {
        if (students[i].student_id === req.params.id)
        {
            found = 1;

            console.log(req.body.mentor);
            let mentor_id = req.body.mentor;

            let mentorAlreadyPresent = helperFns.checkMentorAlreadyPresent;
            let isMentorPresent = mentorAlreadyPresent(mentor_id, mentors);

                
            if (!isMentorPresent)
            {
                res.status(404).json({"Error":"No such Mentor available"})
            }

            else
            {
                students[i].mentor_id = mentor_id;
                res.status(200).json({ "Success": students[i] });
            }
            
        }

      
    }

     if(found===0)
            res.status(400).json({ "Error": "No such student available" });
       
    
})

//Deleting a student
app.delete('/delete-student/:id', (req, res) => {
  
    let found = 0;
    
    //Searching for student, if found, found=1
    for (let i = 0; i < students.length; i++)
    {
        if (students[i].student_id === req.params.id)

        {
            found = 1;
            let deletedStudent = students[i];
            
            //Deleting student details in the associated mentor
            for (let k = 0; k < mentors.length; k++)
                if (mentors[k].student_ids.includes(deletedStudent.mentor_id))
                {
                    for (let x = 0; x < mentors[k].student_ids.length; x++)
                    {
                        if (mentors[k].student_ids[x] === deletedStudent.student_id)
                            mentors[k].student_ids.splice(x, 1);
                    }
                }
            students.splice(i, 1);
            res.status(200).json({ "Deleted Successfully": deletedStudent });
        
        }
      
    }

     if(found===0)
            res.status(400).json({ "Error": "No such student available" });
})

//Deleting a Mentor
app.delete('/delete-mentor/:id', (req, res) => {
  
    let found = 0;
    
    //Searching for student, if found, found=1
    for (let i = 0; i < mentors.length; i++)
    {
        if (mentors[i].mentor_id === req.params.id)

        {
            found = 1;
            let deletedMentor = mentors[i];
            //Remove mentor details of associated students
            for (let k = 0; k < deletedMentor.student_ids.length; k++)
            {
                for (let j = 0; j < students.length; j++)
                    if (students[j].student_id === deletedMentor.student_ids[k])
                    {
                        students[j].mentor_id = "";
                        break;
                    }
                
            }

            mentors.splice(i, 1);
            res.status(200).json({ "Deleted Successfully": deletedMentor });
        
        }
      
    }

     if(found===0)
            res.status(400).json({ "Error": "No such Mentor available" });
})
app.listen(4001,()=>{console.log("App runs with 4001")});
