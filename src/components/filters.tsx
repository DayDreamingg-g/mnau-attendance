import {CustomSelect} from './custom-select';
import type {
  Filters as FilterValues,
} from '@/lib/filters';

import type {
  filterOptions,
} from '@/lib/analytics';

type Options=Awaited<
  ReturnType<typeof filterOptions>
>;

export function Filters({
  value,
  options,
  hide=[],
}:{
  value:FilterValues;
  options:Options;
  hide?:string[];
}){
  return <form
    className="filters"
    method="GET"
  >
    <label>
      Курс

      <CustomSelect name="course" label="Курс" defaultValue={String(value.course??'')}
        options={[{value:'',label:'Усі курси'},...[1,2,3,4].map(course=>({value:String(course),label:`${course} курс`}))]}/>

    </label>

    <label>
      Від

      <input
        type="date"
        name="from"
        defaultValue={value.from}
        required
      />
    </label>

    <label>
      До

      <input
        type="date"
        name="to"
        defaultValue={value.to}
        required
      />
    </label>

    {!hide.includes('specialty')&&
      <label className="filter-wide">
        Спеціальність

        <CustomSelect name="specialty" label="Спеціальність" defaultValue={value.specialty??''}
          options={[{value:'',label:'Усі спеціальності'},...options.specialties.map((specialty,index)=>{
            const duplicate=options.specialties.some((candidate,candidateIndex)=>candidateIndex!==index&&candidate.name===specialty.name);
            const groups=options.groups.filter(group=>group.specialty.id===specialty.id).map(group=>group.name).slice(0,2).join(', ');
            return {value:specialty.id,label:specialty.name+(duplicate?` · ${groups}`:'')};
          })]}/>

      </label>
    }

    {!hide.includes('group')&&
      <label>
        Група

        <CustomSelect name="group" label="Група" defaultValue={value.group??''}
          options={[{value:'',label:'Усі групи'},...options.groups.map(group=>({value:group.id,label:group.name}))]}/>

      </label>
    }

    {(['specialty','group'] as const).filter(key=>hide.includes(key)).map(key=>value[key]&&
      <input key={key} type="hidden" name={key} value={value[key]}/>
    )}

    {value.student&&<input type="hidden" name="student" value={value.student}/>}
    {value.scope&&<input type="hidden" name="scope" value={value.scope}/>}

    {value.faculty&&
      <input
        type="hidden"
        name="faculty"
        value={value.faculty}
      />
    }

    {value.subject&&
      <input
        type="hidden"
        name="subject"
        value={value.subject}
      />
    }

    {value.status&&
      <input
        type="hidden"
        name="status"
        value={value.status}
      />
    }

    {value.threshold&&
      <input
        type="hidden"
        name="threshold"
        value={value.threshold}
      />
    }

    {value.sort&&
      <input
        type="hidden"
        name="sort"
        value={value.sort}
      />
    }

    {value.order&&
      <input
        type="hidden"
        name="order"
        value={value.order}
      />
    }

    <button
      className="button primary"
      type="submit"
    >
      Застосувати
    </button>
  </form>;
}
