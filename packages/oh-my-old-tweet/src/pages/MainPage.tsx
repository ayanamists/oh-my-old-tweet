import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseUserName } from '../InputParser';
import MainLayout from '../Layout/MainLayout';

function MarkBox({ text }: { text: string }) {
  return <mark className="px-2 text-white bg-tw-blue text-white rounded">{text}</mark>
}

function MainPage() {
  const [inputValue, setInputValue] = useState<string>("_iori_n");
  const navigate = useNavigate();

  const handleStart = () => { 
    const user = parseUserName(inputValue);
    navigate(`/${user}`);
  };

  return (
    <div className='flex flex-col'>
        <div className='mx-auto max-w-screen-sm text-center'>
          <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
            Oh <MarkBox text='my' /> old <MarkBox text='tweet' />
          </h1>
        </div>
        <div className="flex max-w-screen-sm mx-auto">
          <span className="inline-flex items-center px-3 text-sm
          text-gray-900 bg-gray-200
          border border-r-0 border-gray-300 rounded-l-md
          dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
            @
          </span>
          <input type="text" id="website-admin" className="
          rounded-none
          rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1
          min-w-0 text-sm border-gray-300 p-2.5
          dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder={inputValue}
            onChange={(evt) => {
              setInputValue(evt.target.value ?? "");
            }}
            onKeyDown={(evt) => {
              if (evt.key === 'Enter') {
                handleStart();
              }
            }}
          />
        </div>
        <div className='mx-auto text-center my-4'>
          <button className="bg-transparent hover:bg-tw-blue
        font-semibold py-2 px-4 hover:text-white
        border border-tw-blue hover:border-transparent rounded dark:border-gray-600
        text-tw-blue dark:text-white"
            onClick={handleStart}>
            Start
          </button>
        </div>
      </div>
    );
}

export default function page() {
  return (<MainLayout>
    <MainPage />
  </MainLayout>);
}